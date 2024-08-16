import { describe, it, expect, afterEach, vi } from "vitest";
import * as diffusion from "diffusion";

import { isPlaceHolder, JsonCsvFeed, placeHolder, TimeSeriesCsvFeed } from "./CsvFeed";
import { addMs, Row } from "./Common";
import logger from '../logger';

const fourRows: Row[] = [
    {
        tm: new Date(0),
        value: 1000
    },
    {
        tm: new Date(25),
        value: 1001
    },
    {
        tm: new Date(75),
        value: 1002
    },
    {
        tm: new Date(100),
        value: 1003
    }
];

describe("#placeHolder", () => {
    const timeNow = new Date();
    it("makes a placeHolder", () => {
        const row = placeHolder(timeNow);
        expect(row.tm).toBe(timeNow);
    });
    it("detects a placeHolder", () => {
        const row = placeHolder(timeNow);
        expect(isPlaceHolder(row)).toBe(true);
    });
    it("doesn't detects non placeHolders", () => {
        const row: Row = {tm: timeNow, foo: 1, bar: 2};
        expect(isPlaceHolder(row)).toBe(false);
    });
});


describe("#JsonCsvFeed", () => {
    const setMock = vi.fn();
    const us = {
        set: setMock
    } as unknown as diffusion.UpdateStream;
    
    afterEach(() => {
        vi.resetAllMocks();
    });

    it("Can construct", async () => {
        const us = {
            set: vi.fn()
        } as unknown as diffusion.UpdateStream;

        const feed = new JsonCsvFeed(us, "some/topic", fourRows, new Date());
        expect(feed.rows.length).toBe(4);
        expect(feed.topicPath).toEqual("some/topic");        
    });

    it("Can replay", async () => {
        const timeNow = new Date();
        const feed = new JsonCsvFeed(us, "some/topic", [...fourRows], timeNow);

        await feed.replay();

        expect(us.set).toHaveBeenCalledTimes(4);
        expect(setMock.mock.calls[0][0].value).toBe(1000);
        expect(setMock.mock.calls[1][0].value).toBe(1001);
        expect(setMock.mock.calls[2][0].value).toBe(1002);
        expect(setMock.mock.calls[3][0].value).toBe(1003);
    });

    it("Can fast forward & play", async () => {
        const ff = 50;
        const timeNow = new Date();

        const feed = new JsonCsvFeed(us, "some/topic", [...fourRows], timeNow);
        const eventsForwarded = await feed.fastForward(ff);
        expect(eventsForwarded).toBe(2)

        expect(setMock).toHaveBeenCalledTimes(1);
        expect(setMock.mock.calls[0][0].value).toBe(1001);

        await feed.replay();

        expect(setMock).toHaveBeenCalledTimes(3);
        expect(setMock.mock.calls[1][0].value).toBe(1002);
        expect(setMock.mock.calls[2][0].value).toBe(1003);
    });

});

describe("#TimeSeriesCsvFeed", () => {

    const appendMock = vi.fn();
    const timeseries = {
        append: appendMock
    } as unknown as diffusion.TimeSeries;


    afterEach(() => {
        vi.resetAllMocks();
    });

    it("Can construct", () => {
        const timeNow = new Date();
        const feed = new TimeSeriesCsvFeed(timeseries, "topic/path", fourRows, timeNow);

        expect(feed.rows).toBe(fourRows);
        expect(feed.topicPath).toBe("topic/path");
    });

    it("Can replay", async () => {
        const timeNow = new Date();
        const feed = new TimeSeriesCsvFeed(timeseries, "topic/path", fourRows, timeNow);

        await feed.replay();

        expect(appendMock).toHaveBeenCalledTimes(4);
        expect(appendMock.mock.calls[0][1].value).toBe(1000);
        expect(appendMock.mock.calls[1][1].value).toBe(1001);
        expect(appendMock.mock.calls[2][1].value).toBe(1002);
        expect(appendMock.mock.calls[3][1].value).toBe(1003);
    });

    it("Can fast forward & play", async () => {
        const ff = 50;
        const timeNow = new Date();

        const feed = new TimeSeriesCsvFeed(timeseries, "topic/path", fourRows, timeNow);
        const eventsForwarded = await feed.fastForward(ff);
        expect(eventsForwarded).toBe(2)

        expect(appendMock).toHaveBeenCalledTimes(2);
        expect(appendMock.mock.calls[0][1].value).toBe(1000);
        expect(appendMock.mock.calls[1][1].value).toBe(1001);

        await feed.replay();

        expect(appendMock).toHaveBeenCalledTimes(4);
        expect(appendMock.mock.calls[2][1].value).toBe(1002);
        expect(appendMock.mock.calls[3][1].value).toBe(1003);
    });

    it("can FF and replay larger volumes of data", async () => {

        const makeRows = (rowCount:number) => Array.from({length: rowCount}).map((v,i) => ({
            tm: new Date((i+1) * 1000),
            value: + (i+1) * 1000
        }));
        
        const manyRows = makeRows(100); // dates from 1_000 to 100_000 in steps 1_000, 2_000, etc
        expect(manyRows[manyRows.length -1].value).toBe(100_000);
        expect(manyRows[0].value).toBe(1_000);

        const timeNow = new Date();
        const feed = new TimeSeriesCsvFeed(timeseries, "topic/path", manyRows, timeNow);

        const rangeMs = manyRows[manyRows.length -1].tm.getTime() - manyRows[0].tm.getTime();
        const eventsForwarded = await feed.fastForward(rangeMs - 50);
        expect(eventsForwarded).toBe(99);
        expect(appendMock).toHaveBeenCalledTimes(99);

        await feed.replay();

        expect(appendMock).toHaveBeenCalledTimes(100);
        expect(appendMock.mock.calls[99][1].value).toBe(100_000);
    });

});

