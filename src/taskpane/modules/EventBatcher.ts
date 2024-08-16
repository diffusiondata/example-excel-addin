import * as diffusion from "diffusion";
/**
 * An event with a key. For example a topic path.
 */
export abstract class KeyedEvent<K> {
  constructor(public key: K) {}
}

/**
 * A topic update.
 * Holds the topic path and the topic value.
 * There is not currently a discrete TopicSubscribedEvent.
 */
export class TopicUpdateEvent<T> extends KeyedEvent<string> {
  constructor(topicPath: string, readonly topicValue: T) {
    super(topicPath);
    this.topicValue = topicValue;
  }
}

/**
 * A topic un-subscription.
 * Holds the topic path and the un-subscription reason.
 */
export class TopicUnsubscribedEvent extends KeyedEvent<string> {
  readonly reason: diffusion.UnsubscribeReason;

  constructor(topicPath: string, reason: diffusion.UnsubscribeReason) {
    super(topicPath);
    this.reason = reason;
  }
}

export enum BatchReadyReason {
  FULL = "full",
  TIMEOUT = "timeout",
}

/**
 * The coalition of 1 or more `KeyedEvent` objects.
 * Stores only the latest event for a given key.
 */
export class EventBatch<K> {
  private readonly maxBatchEvents: number;
  private readonly maxBatchMillis: number;
  private readonly map = new Map<K, KeyedEvent<K>>();

  readonly ready: Promise<BatchReadyReason>;
  private setReady!: (value: BatchReadyReason | PromiseLike<BatchReadyReason>) => void;
  private eventCounter = 0;

  constructor(maxBatchEvents: number, maxBatchMillis: number) {
    this.maxBatchEvents = maxBatchEvents;
    this.maxBatchMillis = maxBatchMillis;

    this.ready = new Promise<BatchReadyReason>((resolve) => {
      this.setReady = resolve;
    });
  }

  /**
   * Add an event to the batch. If the batch is full, field `ready` is resolved.
   * A timeout is begun if their is none.
   * @template K The type of the key, e.g. a topic path string
   * @param {KeyedEvent<K>} ev event to add.
   */
  add(ev: KeyedEvent<K>): void {
    if (this.eventCounter == 0) {
      setTimeout(() => {
        this.setReady(BatchReadyReason.TIMEOUT);
      }, this.maxBatchMillis);
    }

    this.eventCounter += 1;
    this.map.set(ev.key, ev);

    if (this.eventCounter == this.maxBatchEvents) {
      this.setReady(BatchReadyReason.FULL);
    }
  }

  /**
   * @returns {number} The number of events in the batch.
   */
  public get size(): number {
    return this.map.size;
  }

  /**
   * @template K The type of the key, e.g. a topic path string
   * @returns {IterableIterator<KeyedEvent<K>>} An iterator over the events in the batch.
   */
  public values(): IterableIterator<KeyedEvent<K>> {
    return this.map.values();
  }
}

/**
 * A function type, capable of receiving and processing batches.
 * @returns {Promise<void>} A promise that resolves only when the batch is processed.
 */
export type EventBatchReceiver<K> = (batch: EventBatch<K>) => Promise<void>;

/**
 * A class to coalesce a stream of keyed events and deliver them as keyed batches to an
 * EventBatchReceiver function. A batch is delivered when its `ready` promise resolves
 * and no current call to receiver is ongoing.
 */
export class EventBatcher<K> {
  /** The maximum number of events received after which the batch is marked as ready for processing. */
  private readonly maxEventCounter: number;

  /** The maximum ms after which the batch is marked as ready for processing. */
  private readonly batchMs: number;

  /**
   * The async function to which batches are delivered.
   * A maximum of 1 batch is processed at a time.
   */
  private readonly receiver: EventBatchReceiver<K>;

  /**  The current batch into which events are coalesced. */
  private currentBatch: EventBatch<K>;

  public constructor(receiver: EventBatchReceiver<K>, maxEvents: number, batchMs: number = 100) {
    this.maxEventCounter = maxEvents;
    this.batchMs = batchMs;
    this.currentBatch = new EventBatch(this.maxEventCounter, this.batchMs);
    this.receiver = receiver;

    this.prepareCurrentBatch();
  }

  /**
   * Return a promise of any pending work. For testing purposes.
   * @returns {Promise<BatchReadyReason>} A promise that resolves to the reason for pending work.
   * @throws {Error} If there is no pending work.
   */
  public get pendingWork(): Promise<BatchReadyReason> {
    if (this.currentBatch.size == 0) {
      throw new Error(`${this.constructor.name} has no pending work`);
    }
    return this.currentBatch.ready;
  }

  /**
   * Add an event to the event batcher.
   * @template K The type of the key.
   * @param {KeyedEvent<K>} ev Event added to the batch. Any prior event with the same key is overwritten.
   */
  public submit(ev: KeyedEvent<K>): void {
    this.currentBatch.add(ev);
  }

  /**
   * Deliver the current batch to the receiver, replace it with an empty batch
   * @param {BatchReadyReason} _reason the reason the batch is ready.
   * @returns {Promise<void>} A promise that resolves when the batch is processed.
   */
  private async processBatch(_reason: BatchReadyReason): Promise<void> {
    // Grab the current batch and replace it with an empty one.
    const batch = this.currentBatch;
    this.currentBatch = new EventBatch(this.maxEventCounter, this.batchMs);

    await this.receiver(batch);

    // Only when the receiver has completed do we wire-up the promise on the new batch
    this.prepareCurrentBatch();
  }

  private prepareCurrentBatch(): void {
    this.currentBatch.ready.then(this.processBatch.bind(this));
  }
}
