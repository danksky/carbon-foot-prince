## Data Privacy

Your location data never leaves your computer. Once you import the zip file into this window,
the program that was downloaded into your browser when you loaded this webpage starts the analysis;
nothing about your location data leaves. The webpage does send usage data, such as clicks, to Google Analytics.
If you're still curious, you can view the [source code here](https://github.com/danksky/carbon-analysis).

## Calculation

### Personal Transportation Emissions

Google location history export files include series of activity segments, data objects that describe one particular movement (e.g. your drive to the grocery store). Each of these activity segments includes the start time and location, end time and location, distance of travel (meters), and most likely mode of transportation. The modes include, but may not be limited to:

```
IN_PASSENGER_VEHICLE, CYCLING, WALKING, IN_BUS, HIKING, MOTORCYCLING, IN_TRAM, RUNNING, FLYING, STILL, IN_FERRY, IN_TRAIN, SAILING, SKIING, IN_SUBWAY, IN_VEHICLE, UNKNOWN_ACTIVITY_TYPE
```

Personal emissions are calculated using the following function: `e = cd`, where

- `e` = emissions of CO<sub>2</sub> (kgCO<sub>2</sub>)
- `c` = emissions factor (kgCO<sub>2</sub>/km<sub>passenger</sub>)
- `d` = distance (km)

and `c` varies according to the activity type. The various functions used to determine personal emissions are defined in [`getActivityEmissions(distance, activity)`](index.js).

#### Personal 2015 Paris Climate Accords Goal

Based off a 4.52% reduction of your emissions every year after 2015 until 2030, this goal is custom. This is a tricky one to calculate, because the program doesn't know anything about you or your emissions history prior to 2015, as Google location history data is invariably unreliable before then. It can, however, look at your personal transportation emissions history for every year including and after 2015 and take the average.

Your yearly 2015 Paris Climate Accords goal is defined by [`getAnnualBudgetAllowance(reductionPercentageGoal, currentYear, annualEmissionsAverage)`](index.js).

##### Example

Assume that until 2015, someone emitted an average of 6 kgt<sub>CO<sub>2</sub></sub> per year, and in order to reach an annual emission of 3 kgt<sub>CO<sub>2</sub></sub> by 2030, they would need to cut 4.52% each year.

For 2016, the calculation would look like this: **6 \* (1 - 0.0452)<sup>2</sup> = 5.46985824**, where the exponent (2) is defined by the n<sup>th</sup> year since then end of 2014.

#### USA Transportation Emissions Per Capita

#### Global Transportation Emissions Per Capita

Glad you asked. You can help verify

## Contribute

If you've thought of a new feature or found a ~bug~ [undocumented feature](https://en.wikipedia.org/wiki/Undocumented_feature), either open a pull request, or, if you aren't a coder, [create an issue](https://github.com/danksky/carbon-analysis/issues/new) in this repository.
