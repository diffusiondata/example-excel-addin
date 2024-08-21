#!/usr/bin/env ts-node
import { argv, exit } from "process"
import * as diffusion from "diffusion";

import logger from './logger';
import {AbstractCsvFeed} from "./modules/CsvFeed";
import {MILLIS_PER_HOUR, TopicFileDetail} from "./modules/Common";
import {DEFAULT_DIFFUSION_SERVER} from '../src/taskpane/modules/AuthDefaults';

type TopicFile = {
    [topicPath: string]: TopicFileDetail
};

async function main(args:string[]) {
    const topicFile: TopicFile = require('./Topicfile.json');
    logger.info(`Configuration: ${JSON.stringify(topicFile)}`);

    const session  = await diffusion.connect(DEFAULT_DIFFUSION_SERVER.serverLocation.toOptions());
    logger.info(`Connected to ${DEFAULT_DIFFUSION_SERVER.serverLocation} with session ${session.sessionId}`);

    if (Object.entries(topicFile).length == 0) {
        console.error(`Topicfile is empty`);
        exit(1);
    }

    // Load the files asynchronously
    const startTime = new Date();
    const promises: Promise<AbstractCsvFeed>[] = Object.entries(topicFile).map(
        ([topicPath, value]) => AbstractCsvFeed.build(session, topicPath, value, startTime)
    );
    const files = await Promise.all(promises);

    const durationMs = new Date().getTime() - startTime.getTime();
    logger.info(`Loaded ${files.length.toLocaleString()} feeds in ${(durationMs / 1_000).toFixed(2)}s`);
    
    const timeNow = new Date();

    // Press FF
    const FF_TIME = MILLIS_PER_HOUR * 6;
    await Promise.all(files.map(f => f.fastForward(FF_TIME)));
    logger.info(`Fast forward by ${FF_TIME.toLocaleString()}ms complete`);

    // Press PLAY
    const loaders = files.map(f => f.replay());
    await Promise.all(loaders);
    logger.info(`Replay complete`);

    session.close();
}

const args = argv.slice(2);

main(args).catch(err => {
    console.error(`Unhandled error: `, err);
    console.dir(err);;
});

