import { JsonPointer } from "json-ptr";

/**
 * A store of commonly used types and functions.
 */

/**
 * Value types acceptable to Excel cells.
 */
export type Primitive = string | number | boolean;

/**
 * A string holding a GUID. For declarative clarity.
 */
export type GUID = string;

/**
 * An object with a key.
 */
export type KeyedObject = {
  readonly key: string;
};

/**
 * An object representing a financial instrument, it's symbol, provider and originating topic path.
 */
export type SymbolTopicRow = {
  symbol: string;
  topicPath: string;
  provider: string;
};

/**
 * A table of SymbolTopicRows.
 */
export type SymbolTopicTable = SymbolTopicRow[];

/**
 * Test for primitive values.
 * @param {any} value a value to test.
 * @returns {boolean} true if `value` is a primitive value
 */
export function isPrimitive(value: any): boolean {
  return value === null || (typeof value !== "object" && typeof value !== "function");
}

/**
 * Decompose any object into a map of the JSONPointer leaf nodes and associated values.
 * e.g. {a: {b: 1, c: 2}} => {"a/b": 1, "a/c": 2}
 * @param {any} value any values
 * @returns {Map<string, Primitive>} a map of JSONPointer leaf nodes and associated values.
 */
export function toPointerLeafMap(value: any): Map<string, Primitive> {
  const result = new Map<string, Primitive>();
  JsonPointer.visit(value, (pointer, value) => {
    if (isPrimitive(value)) {
      result.set(pointer, value as Primitive);
    }
  });
  return result;
}

/**
 * Generate range of numbers
 * @param {number} start the start of the range, inclusive.
 * @param {number} end the end of the range, inclusive.
 * @returns {number[]} an array holding the numbers start to end, inclusive.
 */
export function rangeFrom(start: number, end: number): number[] {
  if (end < start) {
    throw new Error("Illegal argument. end < start");
  }
  return Array.from({ length: end - start + 1 }, (_, i) => i + start);
}

/**
 * Analogous to java.util.Map.computeIfAbsent.
 * Fetches the value for a key. If the value is absent it is computed and inserted and then returned.
 * @template K the key type
 * @template V the value type
 * @param {Map<K, V>} map The map to from which the value is retrieved.
 * @param {K} key The key to retrieve a value for.
 * @param {(key: K) => V} mappingFunction The function to compute the value if absent.
 * @returns {V} The retrieved value.
 */
export function computeIfAbsent<K, V>(map: Map<K, V>, key: K, mappingFunction: (key: K) => V): V {
  if (!map.has(key)) {
    map.set(key, mappingFunction(key));
  }
  return map.get(key) as V;
}

/**
 * pause for n ms.
 * @param {number} n the number of milliseconds to pause.
 * typically use with await
 * @returns {Promise<void>} a Promise that resolves after n.
 */
export function pause(n: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, n));
}

/**
 * Increment a number value for a given key.
 * Absent keys are inserted and set to 1
 * @template K the key type
 * @param {Map<K, number>} map The map to increment the value in.
 * @param {K} key The key to increment.
 */
export function incrementOrSet<K>(map: Map<K, number>, key: K) {
  map.set(key, computeIfAbsent(map, key, () => 0) + 1);
}

/**
 * Capitalise the 1st character of a non-empty string.
 * @param {string} str The input string.
 * @returns {string} The capitalized string.
 */
export function capitaliseFirstLetter(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}
