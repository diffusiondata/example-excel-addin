# Capital Market Data Loader

This directory contains historic market data and code to re-play it to a Diffusion server at the same speed at which it was recorded. The raw market data is stored in CSV files inside `./market-data/`

# Preparation

Ensure you have followed step `Configure Diffusion URL and credentials` in the root `README.md`

```
npm install
```

# Usage

```
npm run load
```
Once the script outputs the following line it has begun re-playing market data at the original speed.
```
2024-08-15 15:57:15 info: Fast forward by 21,600,000ms complete
```

# Contents

* `index.ts` scans the contents of `./market-data` and builds `./Topicfile.json`

* `load.ts` loads `./Topicfile.json` and replays the data within at the same rate is was recorded. To load any time series topics with historic data this script wil fast-forward 6hours of activity before playing the data at original speed.

* `vary.ts` creates a 2nd data feed from an original. It analyses the original to gather the powers of ten that each instruments varies at, picks the most common, and applies a random value at the same power to each of the numeric fields to create a new believable value. 
This was used to create the `ACMEBank.com` datafeed. It does not vary the timestamps. 
