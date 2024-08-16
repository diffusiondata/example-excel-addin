import * as diffusion from "diffusion";
import { Primitive } from "./Common";
import { TableContentProvider, TableSchema, TableViewer } from "./TableViewer";
import { EventBatch, EventBatcher, TopicUnsubscribedEvent, TopicUpdateEvent } from "./EventBatcher";
import { JsonPointer } from "json-ptr";
import { buildFromSelector } from "./SuperSchema";

/**
 * A TableViewer for financial instruments.
 *
 * InstrumentTableView encapsulates the streaming of live data from Diffusion to Excel and is
 * written to prevent the streaming of live data faster than Excel can recalculate, which
 * would rendering Excel unresponsive to user input.
 *
 * In broad terms, it receives topic updates from Diffusion and delivers them to
 * anEventBatcher to coalesce streams of updates into update batches. Batches are
 * passed to the receiver function which categorizes updates into topic additions,
 * updates, and removals, and then passes them to the TableViewer.
 */
export class InstrumentTableViewer {
  private topicPaths: Map<string, diffusion.ValueStream> = new Map();

  constructor(private session: diffusion.Session, private batcher: EventBatcher<string>) {}

  /**
   * Subscribe to a topic holding instrument data.
   * @param {string} topicPath path of a topic holding instrument data.
   */
  async addTopicPath(topicPath: string) {
    const valueStream = this.session.addStream(topicPath, diffusion.datatypes.json());

    valueStream.on({
      value: (topicPath, _spec, newValue, _oldValue) => {
        this.batcher.submit(new TopicUpdateEvent<diffusion.JSON>(topicPath, newValue));
      },
      unsubscribe: (topicPath, _spec, reason) => {
        this.batcher.submit(new TopicUnsubscribedEvent(topicPath, reason));
      },
    });
    await this.session.select(topicPath);

    this.topicPaths.set(topicPath, valueStream);
  }

  /**
   * Builder function for the InstrumentTableViewer.
   * Calculates the super-schema from the initial set of topic paths.
   * @param {diffusion.Session} session session connected to the Diffusion server
   * @param {string[]} topicPaths Initial set of topic paths to subscribe to.
   * @returns {Promise<InstrumentTableViewer>} A promise that resolves to an InstrumentTableViewer instance.
   */
  static async build(session: diffusion.Session, topicPaths: string[]): Promise<InstrumentTableViewer> {
    const composeSelector = (topicPaths: string[]): diffusion.TopicSelector =>
      diffusion.selectors.parse(topicPaths.map((path) => `>${path}`));

    // Create the tableViewer
    const contentProvider: TableContentProvider<TopicUpdateEvent<diffusion.JSON>> = {
      getField(input: TopicUpdateEvent<diffusion.JSON>, fieldName: string): Primitive {
        return fieldName === "topicPath"
          ? input.key
          : (new JsonPointer(fieldName).get(input.topicValue.get()) as Primitive);
      },
    };

    // Calculate the super-schema
    const selector = composeSelector(topicPaths);
    const superSchema = await buildFromSelector(session, selector);
    const schema = new TableSchema(["topicPath", ...superSchema.keys()], "topicPath");
    const tableViewer = await TableViewer.build("A1", schema, contentProvider);

    // Wire up to an EventBatcher
    const receiver = async (batch: EventBatch<string>) => {
      console.debug(`Receiving batch of ${batch.size} events...`);
      try {
        const inserts: TopicUpdateEvent<diffusion.JSON>[] = [];
        const updates: TopicUpdateEvent<diffusion.JSON>[] = [];
        const removals: string[] = [];

        for (let ev of batch.values()) {
          if (ev instanceof TopicUpdateEvent) {
            (tableViewer.has(ev.key) ? updates : inserts).push(ev);
          } else if (ev instanceof TopicUnsubscribedEvent) {
            removals.push(ev.key);
          }
        }

        await Promise.all([
          tableViewer.addRows(inserts),
          tableViewer.updateRows(updates),
          tableViewer.removeRows(removals),
        ]);
      } catch (err) {
        console.error("Caught error processing batch", err);
      }
    };
    const batcher = new EventBatcher<string>(receiver, 10 * 1024);
    const result = new InstrumentTableViewer(session, batcher);

    topicPaths.forEach((topicPath) => {
      result.addTopicPath(topicPath);
    });

    return result;
  }
}
