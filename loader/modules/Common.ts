
export type Row = {
    tm: Date,
    [key: string]: number | Date
};

export type TopicFileDetail = {
    file: string,
    timeSeries?: {
        [key: string]: string
    }
};

export const MILLIS_PER_HOUR = 1_000 * 60 * 60;
export function addMs(date: Date, ms: number): Date {
    return new Date(date.getTime() + ms);
}
