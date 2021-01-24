# Carbon Foot Prince

Live at: https://carbonfootprince.com

A carbon emissions calculator website that uses your Google location history to give you detailed insights into the impact your personal transporation has on the environment. Everything can be run offline (client-side analysis).

I hope you'll jump in and improve this site! It's pure HTML, CSS, and (vanilla) Javascript!

## In this Project

- [Previews](#previews)
  - [Desktop](#desktop)
  - [Mobile](#mobile)
- [How to Run Locally](#how-to-run-locally)
- [Calculation](#calculation)
  - [Personal Transportation Emissions](#personal-transportation-emissions)
  - [USA Personal Transportation Emissions Per Capita](#usa-personal-transportation-emissions-per-capita)
  - [USA Personal Transportation Emissions Per Capita - 2015 Paris Climate Accords Goal](#usa-personal-transportation-emissions-per-capita---2015-paris-climate-accords-goal)
    - [Example](#example)
  - [Global Transportation Emissions Per Capita](#global-transportation-emissions-per-capita)
- [Contribute](#contribute)
- [Thanks](#thanks)
  - [Packages](#packages)
  - [Art](#art)
- [Data Privacy](#data-privacy)
- [License](#license)

## Previews

### Desktop

<div>
<img width="450" src="https://user-images.githubusercontent.com/10901068/105646574-44454e80-5e66-11eb-8614-f4c5d30fe2ff.png" style="display: inline-block;">
<img width="450" src="https://user-images.githubusercontent.com/10901068/105646605-5cb56900-5e66-11eb-9f5e-ae2bf76b2488.png" style="display: inline-block;">
</div>

### Mobile

<div>
<img width="200" src="https://user-images.githubusercontent.com/10901068/105647446-5ecdf680-5e6b-11eb-8ae2-f7205e3adf62.png" style="display: inline-block;">
<img width="200" src="https://user-images.githubusercontent.com/10901068/105646696-f250f880-5e66-11eb-8fc3-c335c7bd4612.png" style="display: inline-block;">
</div>

## How to Run Locally

1. `git clone` the repository
2. `cd carbon-foot-prince`
3. `python -m http.server 8080` [(run a web server from that directory)](https://flaviocopes.com/local-web-server/)
4. Open `http://localhost:8080/` in your browser.

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

Source:

UK Department for Business, Energy, and Industrial Strategy - 2019 Government greenhouse gas conversion factors for company reporting

- https://assets.publishing.service.gov.uk/government/imports/system/imports/attachment_data/file/904215/2019-ghg-conversion-factors-methodology-v01-02.pdf

### USA Personal Transportation Emissions Per Capita

Sources:

USA EPA (Light-Duty Vehicles, Motorcycles, Buses, Commercial Aviation, & Rail)

- https://www.epa.gov/greenvehicles/fast-facts-transportation-greenhouse-gas-emissions
- https://www.epa.gov/greenvehicles/archives-fast-facts-us-transportation-sector-greenhouse-gas-emissions

Rhodium Group (2020 estimates)

- https://rhg.com/research/preliminary-us-emissions-2020

Macrotrends (USA population)

https://www.macrotrends.net/countries/USA/united-states/population

### USA Personal Transportation Emissions Per Capita - 2015 Paris Climate Accords Goal

Based off a 4.52% reduction of your emissions every year after 2015 until 2030, this projects that annual reduction onto the average American's personal transportation emissions prior to 2015. To be specific, this looks at the average emissions during the period 2010 to 2015.

Your yearly 2015 Paris Climate Accords goal is defined by [`getAnnualBudgetAllowance(reductionPercentageGoal, currentYear, annualEmissionsAverage)`](index.js).

#### Example

Assume that the average American emitted an average of 6 kgt<sub>CO<sub>2</sub></sub> per year between 2010 and 2015, and in order to reach an annual emission of 3 kgt<sub>CO<sub>2</sub></sub> by 2030, they would need to cut 4.52% each year.

For 2016, the calculation would look like this: **6 \* (1 - 0.0452)<sup>2</sup> = 5.46985824**, where the exponent (2) is defined by the n<sup>th</sup> year since then end of 2014.

### Global Transportation Emissions Per Capita

International Energy Agency (Passenger road vehicles, Aviation, Rail)

- https://www.iea.org/data-and-statistics/charts/transport-sector-co2-emissions-by-mode-in-the-sustainable-development-scenario-2000-2030

Carbon Brief (2020 estimates)

- https://www.carbonbrief.org/global-carbon-project-coronavirus-causes-record-fall-in-fossil-fuel-emissions-in-2020

Worldometers (world population)

- https://www.worldometers.info/world-population/world-population-by-year/

## Contribute

If you've thought of a new feature or found a ~bug~ [undocumented feature](https://en.wikipedia.org/wiki/Undocumented_feature), either open a pull request, or, if you aren't a coder, [create an issue](https://github.com/danksky/carbon-analysis/issues/new) in this repository.

```
.
├── LICENSE
├── README.md
├── images/
├── index.css
├── index.html
├── index.js
├── lib/ (zip.js files)
└── styles/
    ├── desktop
    └── mobile

```

## Thanks

### Packages

- [Google Charts](https://developers.google.com/chart), for visualizing data
- [leaflet.js](http://leafletjs.com/), for rendering the interactive map
- [leaflet.heat](https://github.com/Leaflet/Leaflet.heat), for rendering the heatmap overlay
- [zip.js](https://github.com/gildas-lormeau/zip.js), for unzipping the location export file

### Art

Thanks to the following authors of [flaticon.com](https://www.flaticon.com/)'s SVG repository:

- [free-icon](https://www.flaticon.com/free-icon/)
- [pixel-perfect](https://www.flaticon.com/authors/pixel-perfect)
- [good-ware](https://www.flaticon.com/authors/good-ware)
- [mynamepong](https://www.flaticon.com/authors/mynamepong)
- [adib-sulthon](https://www.flaticon.com/authors/adib-sulthon)
- [xnimrodx](https://www.flaticon.com/authors/xnimrodx)
- [eucalyp](https://www.flaticon.com/authors/eucalyp)
- [pongsakornred](https://www.flaticon.com/authors/pongsakornred)
- [smashicons](https://www.flaticon.com/authors/smashicons)
- [dinosoftlabs](https://www.flaticon.com/authors/dinosoftlabs)
- [freepik](https://www.flaticon.com/authors/freepik)

## Data Privacy

Your location data never leaves your computer. Once you import the zip file into this window,
the program that was downloaded into your browser when you loaded this webpage starts the analysis;
nothing about your location data leaves. The webpage does send usage data, such as clicks, upload
durations, etc. to Google Analytics.

## [License](./LICENSE)
