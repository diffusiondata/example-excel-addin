import * as fs from 'fs';
import * as path from 'path';

import {exit} from "process";
import { TopicFileDetail } from './modules/Common';

const OUTPUT_FILE = "Topicfile.json";

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error(`wrong # args`);
  exit(1);
}

const TICK_FILENAME = /\/(.+?)\/(\w.+?)_Ticks_.*\.csv$/;
const CANDLESTICK_FILENAME = /\/(.+?)\/(\w.+?)_Candlestick_1_M_(BID|ASK)_.*\.csv$/;

const result: {
  [topicPath: string]: TopicFileDetail
} = {};

// Compose list of filenames
const filenames = args.flatMap(dir => fs.readdirSync(dir).map(file => path.join(dir, file)));

filenames.forEach(filename => {

  let match = filename.match(TICK_FILENAME);
  if (match) {
    const [,provider,symbol] = match;
    const topicPath = `market-data/${provider}/fx/${symbol}`;

    result[topicPath] = {file: filename};
    return;
  }

  match = filename.match(CANDLESTICK_FILENAME);
  if (match) {
    const [,provider,symbol,bidOrAsk] = match;
    const topicPath = `market-data/${provider}/fx/${symbol}/candlestick/1min/${bidOrAsk}`;

    result[topicPath] = {file: filename, timeSeries: {
      TIME_SERIES_RETAINED_RANGE: "last 12h",
      TIME_SERIES_SUBSCRIPTION_RANGE: "last 6h"
    }};
    return;
  }
});

// Save the results
const output = JSON.stringify(result, null, 2);
fs.writeFileSync(OUTPUT_FILE, output);

console.log(`Saved ${OUTPUT_FILE} holding ${Object.keys(result).length} feeds.`)