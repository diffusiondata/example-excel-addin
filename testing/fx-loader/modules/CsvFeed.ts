import fs from "fs/promises";
import { parse } from "date-fns";
import logger from '../logger';
import * as diffusion from "diffusion";
import {addMs, Row, TopicFileDetail} from "./Common";

const UTF8 = 'utf8';
const TM_FORMAT = 'dd.MM.yyyy HH:mm:ss.SSS';
var JSON_TOPICSPEC = new diffusion.topics.TopicSpecification(diffusion.topics.TopicType.JSON);


function pause(ms: number) {
    return ms < 1 
        ? Promise.resolve() 
        : new Promise(resolve => setTimeout(resolve, ms < 0 ? 0 : ms));
}

const PlaceHolder = Symbol("PlaceHolder");

type FieldProcessor = (input: string, target: any) => void;

/**
 * Construct a placeholder row
 * @param targetTime 
 * @returns 
 */
export function placeHolder(targetDate: Date): Row {
    const result: Row = {
        tm: targetDate, 
        [PlaceHolder]: NaN
    }
    return result;
}

export function isPlaceHolder(row: Row) {
    return PlaceHolder in row;
}


export abstract class AbstractCsvFeed {
    // The positive number of milliseconds added to a historic timestamp to put it into the current time frame.
    protected dtime: number

    constructor(
        readonly topicPath: string,
        readonly rows: Row[],
        timeNow: Date
    ) {
        const t0 = this.rows[0].tm;
        this.dtime = timeNow.getTime() - t0.getTime();
        if (this.dtime < 0) {
            throw new Error(`negative dtime. ${t0} should be the past`)
        }
    }

    async replay(): Promise<void> {
        logger.debug(`replay(dtime=${this.dtime}`);

        const calculatePause = (record: Row): number => {
            const result = (this.dtime + record.tm.getTime()) - Date.now();
            logger.debug(`calculatePause(record.tm=${record.tm.toISOString()}, +dtime=${addMs(record.tm, this.dtime).toISOString()}) = ${result}`);
            return result;
        }

        let eventCount = 0;
        for(const row of this.rows) {
            await pause(calculatePause(row));
            if (!isPlaceHolder(row)) {
                await this.applyRow(row);
            }
            if((++eventCount % 100) == 0) {
                logger.info(`Updated topic ${this.topicPath} with ${eventCount.toLocaleString()} updates.`);
            }
        }
    }

    /**
     * Forward the tape of events.
     * @param timeNow 
     * @param durationMs milliseconds to wind the tape onward.
     * @returns the number of events forwarded
     */
    async fastForward(durationMs: number): Promise<number> {
        logger.info(`Fast forwarding ${this.topicPath} by ${durationMs.toLocaleString()}ms`);

        // Find the first row with a `tm` greater than t0 + durationMs
        const targetTime = this.rows[0].tm.getTime() + durationMs;
        const nextRowIndex = this.rows.findIndex(r => r.tm.getTime() > targetTime);
        if (nextRowIndex < 0) {
            throw("Too few rows.");
        }

        // Remove rows forwarded past
        const forwardedRows = this.rows.splice(0, nextRowIndex);
        this.processForwardedRows(forwardedRows);

        // Insert 'play head' place holder
        this.rows.unshift(placeHolder(new Date(targetTime)));``

        // Decrement the value of dtime
        this.dtime -= durationMs

        return Promise.resolve(nextRowIndex);
    }

    protected abstract processForwardedRows(forwardedRows: Row[]): Promise<void>;

    /**
     * Contract to inject the value into the topic
     * @param row value inserted into the topic
     */
    abstract applyRow(row: Row): Promise<void>;

    /**
     * The first field is assumed to be a timestamp, and is always renamed to `tm`.
     * Every other field is assumed to be a floating point number, and its fieldname is preserved.
     */
    private static buildFieldProcessor(fieldName: string, index: number): FieldProcessor {
        if (index == 0) {
            return (input, target) => {
                const value = parse(input, TM_FORMAT, new Date());
                target["tm"] = value;
            }
        } else {
            return (input, target) => {
                const value = parseFloat(input);
                target[fieldName] = value;
            }
        }
    }

    public static async build(session: diffusion.Session, topicPath: string, detail: TopicFileDetail, timeNow: Date): Promise<AbstractCsvFeed> {
        // Load the content, and split it
        const data = await fs.readFile(detail.file, UTF8);
        const lines = data.split(/\n/);

        // Load the header & build a schema
        const fieldNames = lines.shift()?.trim().split(",");
        if (!fieldNames) {
            throw new Error(`Cannot load header from ${detail.file}`);
        }
        const schema = fieldNames.map(((fieldName, i) => this.buildFieldProcessor(fieldName, i)));

        // Put the fieldProcessors to work parsing all the lines.
        const rows = lines.map(line => 
            line.trim().split(/,/).reduce((acc, field, index) => 
                (schema[index](field, acc), acc)
            , {} as Row)
        );

        logger.info(`Loaded ${rows.length.toLocaleString()} rows from ${detail.file}`);

        // Create the topic
        if (detail.timeSeries) {
            const topicProps = {
                TIME_SERIES_EVENT_VALUE_TYPE: "json",
                ...detail.timeSeries
            };
            var topicSpec = new diffusion.topics.TopicSpecification(diffusion.topics.TopicType.TIME_SERIES, topicProps);

            // Remove TS topics 1st
            await session.topics.remove(topicPath);

            await session.topics.add(topicPath, topicSpec);
            logger.info(`Created Timeseries topic ${topicPath} with props ${JSON.stringify(topicProps)}`);

            return new TimeSeriesCsvFeed(session.timeseries, topicPath, rows, timeNow);
        } else {
            await session.topics.add(topicPath, JSON_TOPICSPEC);
            logger.info(`Created JSON topic ${topicPath}`);

            const updateStream = session.topicUpdate
                .newUpdateStreamBuilder()
                .build(topicPath, diffusion.datatypes.json());

            return new JsonCsvFeed(updateStream, topicPath, rows, timeNow);
        }
    }
}

export class JsonCsvFeed extends AbstractCsvFeed {
    protected async processForwardedRows(forwardedRows: Row[]): Promise<void> {
        // Insert the prior row
        if (forwardedRows.length > 0) {
            const lastRow = forwardedRows[forwardedRows.length -1];
            if (!isPlaceHolder(lastRow)) {
                await this.applyRow(lastRow);
            }
        }
    }

    constructor(
        private updateStream: diffusion.UpdateStream,
        topicPath: string,
        rows: Row[],
        timeNow: Date,
    ) {
        super(topicPath, rows, timeNow);
    }

    async applyRow(row: Row): Promise<void> {
        await this.updateStream.set(row);
    }

}

export class TimeSeriesCsvFeed extends AbstractCsvFeed {
    private static dataType = diffusion.datatypes.json();
    private static PROMISE_BATCH_SIZE = 512; // Number of outstanding promises before awaiting them all.

    constructor(
        private timeseries: diffusion.TimeSeries,
        topicPath: string,
        rows: Row[],
        timeNow: Date
    ) {
        super(topicPath, rows, timeNow);
    }

    async applyRow(row: Row): Promise<void> {
        await this.timeseries.append(this.topicPath, row, TimeSeriesCsvFeed.dataType, row.tm.getTime());
    }

    protected async processForwardedRows(forwardedRows: Row[]): Promise<void> {
        let promises: Promise<diffusion.EventMetadata>[] = [];

        for(let i=0; i < forwardedRows.length; i++) {
            const row = forwardedRows[i];
            if (!isPlaceHolder(row)) {
                promises.push(this.timeseries.append(this.topicPath, row, TimeSeriesCsvFeed.dataType, row.tm.getTime()));
            }

            if (promises.length >= TimeSeriesCsvFeed.PROMISE_BATCH_SIZE) {
                await Promise.all(promises);
                promises = [];
            }
        }
        await Promise.all(promises);

        logger.info(`Appended ${forwardedRows.length} events to ${this.topicPath}`);
    }
}
 