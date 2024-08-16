import { Session, TopicSelector, datatypes } from "diffusion";
import { toPointerLeafMap, incrementOrSet } from "./Common";

/**
 * The SuperSchema is the super-set of leaf JSONPaths of input topics.
 * e.g. if topic `foo` contains `{a: 1, b: {c: 2}}` and topic `bar` contains `{a: 3, b: {d: 4}}`
 * the super schema is {"/a": 2, "/b/c": 1, "/b/d": 1}.
 *
 * A SuperSchema is a instructive in establishing the columns shown in Excel.
 */
export type SuperSchema = Map<string, number>;

/**
 * Builds a SuperSchema from all JSON topics matching the selector.
 * @param {Session} session the session to the Diffusion server
 * @param {TopicSelector} selector the topic selector describing topics to build the super-schema from.
 * @returns {Promise<SuperSchema>} a Map of leaf node JsonPointer to its occurrence
 */
export async function buildFromSelector(session: Session, selector: TopicSelector): Promise<SuperSchema> {
  let fetchRequest = session.fetchRequest().withValues(datatypes.json());

  let result: SuperSchema = new Map();
  for (let hasMore = true; hasMore; ) {
    const fetchResponse = await fetchRequest.fetch(selector);

    // Build the super schema
    const results = fetchResponse.results();
    result = results.reduce((acc, topicResult) => consumeObjectSchema(topicResult.value().get(), acc), result);

    if (results.length === 0) {
      throw new Error("Inadequate space in which to fetch topics");
    }

    if ((hasMore = fetchResponse.hasMore())) {
      fetchRequest = fetchRequest.after(results[results.length - 1].path());
    }
  }
  return result;
}

/**
 * Calculate the schema of an object, and add it to the given super schema.
 * @param {any} topicValue the object schema to calculate
 * @param {SuperSchema} result the super schema to increment
 * @returns {SuperSchema} the super schema with the object schema added
 */
function consumeObjectSchema(topicValue: any, result: SuperSchema): SuperSchema {
  const leafMap = toPointerLeafMap(topicValue);
  Array.from(leafMap.keys()).forEach((key) => incrementOrSet(result, key));
  return result;
}
