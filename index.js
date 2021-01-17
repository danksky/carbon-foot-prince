(function(obj) {
	var requestFileSystem = obj.webkitRequestFileSystem || obj.mozRequestFileSystem || obj.requestFileSystem;
	var activityEmissionsByDay = {};
	var activityEmissionsByMonth = {};
	var activityEmissionsByYear = {};
	var activityEmissionsTotals = {};
    var fileProcessProgress = {};
    
    var mapDataByYear = {};

    var dailyEmissionsChart = {};

    uploadStage();

    function uploadStage() {
        // interactive document elements
        var fileInput = document.getElementById("file-input");
        var fileProgressMeter = document.getElementById("upload-progress-bar");
        var instructionButton = document.getElementById("instruction-button");
        var instructionSteps = document.getElementById("instructions-steps")

        // passive document elements
        var introContainer = document.getElementById("intro-container");

        var flights = {}; // TODO: Rename to flightPathsByYear and populate during processSegment(); perhaps make another function with switch statements to compile annual points/paths for mapping later.
        var history = {};

        function onerror(message) {
            console.error(message);
            alert(message);
        }

        function getEntries(file, onend) {
            zip.workerScriptsPath = "./lib/";
            zip.createReader(new zip.BlobReader(file), function(zipReader) {
                zipReader.getEntries(onend);
            }, onerror);
        }

        function areAllFilesProcessed() {
            var allProcessed = true;
            Object.entries(fileProcessProgress).forEach(function(progressEntry, index) {
                allProcessed = allProcessed && progressEntry[1].processText;
            })
            return allProcessed;
        }

        // UK Department for Business, Energy, and Industrial Strategy - 2019 Government greenhouse gas conversion factors for company reporting
        // https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/904215/2019-ghg-conversion-factors-methodology-v01-02.pdf
        function getActivityEmissions(distance, activity) {
            switch (activity) {
                case "FLYING": 
                    return 0.101 * distance / 1000;
                case "IN_PASSENGER_VEHICLE":
                    return 0.171 * distance / 1000;
                case "IN_TRAIN":
                    return 0.041 * distance / 1000;
                case "IN_BUS":
                    return 0.104 * distance / 1000;
                case "IN_FERRY": // travelandclimate.org/how-we-have-calculated-ferry
                    return 0.170 * distance / 1000;
                case "MOTORCYCLING":
                    return 0.078 * distance / 1000;
                case "IN_SUBWAY":
                    return 0.035 * distance / 1000;
            }
            return 0;
        }

        function processSegment (segment, index, year, month) {
            if (segment?.activitySegment) {
                var distance = 0;
                if (segment.activitySegment.distance) {
                    distance = segment.activitySegment.distance					
                } else {

                }

                var activityType = segment.activitySegment.activityType;
                if (segment.activitySegment.activities && segment.activitySegment.activities.length > 0) {
                    activityType = segment.activitySegment.activities[0].activityType;
                }
                if (activityType === undefined) {
                    console.log(index, segment);
                }

                var activityEmissions = getActivityEmissions(distance, activityType);
                if (activityEmissions > 0) {
                    if (activityEmissionsTotals[activityType] === undefined) {
                        activityEmissionsTotals[activityType] = activityEmissions;
                    } else {
                        activityEmissionsTotals[activityType] += activityEmissions;
                    }

                    if (activityEmissionsByYear[year][activityType] === undefined) {
                        activityEmissionsByYear[year][activityType] = activityEmissions;
                    } else {
                        activityEmissionsByYear[year][activityType] += activityEmissions;
                    }

                    if (activityEmissionsByMonth[year][month][activityType]) {
                        activityEmissionsByMonth[year][month][activityType] += activityEmissions;
                    } else {
                        activityEmissionsByMonth[year][month][activityType] =  activityEmissions;
                    }

                    if (segment.activitySegment.duration && 
                        segment.activitySegment.duration.startTimestampMs) {
                        var date = (new Date(parseInt(segment.activitySegment.duration.startTimestampMs))).getDate()
                        if (activityEmissionsByDay[year][month][date] === undefined) {
                            activityEmissionsByDay[year][month][date] = {};
                        } 
                        if (activityEmissionsByDay[year][month][date][activityType] === undefined) {
                            activityEmissionsByDay[year][month][date][activityType] = activityEmissions;
                        } else {
                            activityEmissionsByDay[year][month][date][activityType] += activityEmissions;
                        }
                    } else {
                        console.log("no date", index, segment)
                    }
                } else {
                    // not a polluting activity
                }

                var SCALAR_E7 = 0.0000001; // Since Google Takeout stores latlngs as integers

                
                if (segment.activitySegment.startLocation
                    && segment.activitySegment.endLocation
                    && segment.activitySegment.startLocation.latitudeE7
                    && segment.activitySegment.startLocation.longitudeE7
                    && segment.activitySegment.endLocation.latitudeE7
                    && segment.activitySegment.endLocation.longitudeE7) {
                    var startLatitude = segment.activitySegment.startLocation.latitudeE7 * SCALAR_E7,
                    startLongitude = segment.activitySegment.startLocation.longitudeE7 * SCALAR_E7, 
                    endLatitude = segment.activitySegment.endLocation.latitudeE7 * SCALAR_E7,
                    endLongitude = segment.activitySegment.endLocation.longitudeE7 * SCALAR_E7;

                    // Handle negative latlngs due to google unsigned/signed integer bug.
                    if ( startLatitude > 180 ) startLatitude = startLatitude - (2 ** 32) * SCALAR_E7;
                    if ( startLongitude > 180 ) startLongitude = startLongitude - (2 ** 32) * SCALAR_E7;
                    if ( endLatitude > 180 ) endLatitude = endLatitude - (2 ** 32) * SCALAR_E7;
                    if ( endLongitude > 180 ) endLongitude = endLongitude - (2 ** 32) * SCALAR_E7;

                    if (Number.isNaN(startLatitude) || Number.isNaN(startLongitude) || Number.isNaN(endLatitude) || Number.isNaN(endLongitude)) {
                        console.log(segment);
                        // TODO: Handle this case
                    } else {
                        if (mapDataByYear[year] === undefined) {
                            mapDataByYear[year] = {};
                        }
                        switch (activityType) {
                            case "FLYING": 
                            case "IN_TRAIN":
                                if (mapDataByYear[year][activityType] === undefined) {
                                    mapDataByYear[year][activityType] = L.layerGroup();
                                }
                                var sdLatLongs = [
                                    [startLatitude, startLongitude],
                                    [endLatitude, endLongitude]
                                ];
                                var polyline = L.polyline(sdLatLongs, {color: 'red'});
                                mapDataByYear[year][activityType].addLayer(polyline);
                                break;
                            case "IN_BUS":
                            case "IN_FERRY":
                            case "IN_PASSENGER_VEHICLE":
                            case "IN_SUBWAY":
                            case "MOTORCYCLING":
                                if (mapDataByYear[year][activityType] === undefined) {
                                    mapDataByYear[year][activityType] = L.heatLayer([]);
                                } else {
                                    mapDataByYear[year][activityType].addLatLng(
                                        [startLatitude, startLongitude]
                                    );
                                }
                                break;
                        }
                    }
                } else {

                }
                
            } else if (segment?.placeVisit) {

            } else {
            }

        }  

        function onAllFilesProcessed() {
            gtag('event', 'on_all_files_processed');
            hideUploadStage();
            presentationStage();
        }  

        function getTotalReadFileProgress() {
            var totalProgress = 0;
            Object.entries(fileProcessProgress).forEach(function(progressEntry) {
                totalProgress += progressEntry[1].readText;
            })
            return totalProgress / Object.keys(fileProcessProgress).length;
        }

        function onFileReadDone(fileName, year, month, fileText) {
            var parsedSemanticHistory = JSON.parse(fileText);
            history[fileName] = parsedSemanticHistory; // TODO: Potentially remove.
            if (parsedSemanticHistory?.timelineObjects) {
                parsedSemanticHistory.timelineObjects.forEach(function(segment, index) { 
                    processSegment(segment, index, year, month);
                });
                fileProcessProgress[fileName] = {
                    readText: fileProcessProgress[fileName].readText,
                    processText: true,
                };
                if (areAllFilesProcessed()) {
                    onAllFilesProcessed();
                }
            } else {

            }
        }
        
        // onFileReadProgress - onprogress callback
        function onFileReadProgress(fileName, current, total) {
            fileProcessProgress[fileName] = {
                readText: current / total,
                processText: false,
            };
            fileProgressMeter.style.width = getTotalReadFileProgress()*100 + "%";
        }

        function handleExtractedFile(entry, index) {	
            // populate activityEmissions objects		
            var pathComponents = entry.filename.split("/");
            var year = pathComponents[pathComponents.length - 2]; // string
            var month = pathComponents[pathComponents.length - 1].split("_")[1].split(".")[0]; // after the '20XX_' and before the '.json'

            if (activityEmissionsByYear[year] === undefined) {
                activityEmissionsByYear[year] = {};
            }

            if (activityEmissionsByMonth[year] === undefined) {
                activityEmissionsByMonth[year] = {};
            }
            if (activityEmissionsByMonth[year][month] === undefined) {
                activityEmissionsByMonth[year][month] = {};
            }

            if (activityEmissionsByDay[year] === undefined) {
                activityEmissionsByDay[year] = {};
            }
            if (activityEmissionsByDay[year][month] === undefined) {
                activityEmissionsByDay[year][month] = {};
            }

            if (flights[year] === undefined) {
                flights[year] = {};
            }
            if (flights[year][month] === undefined) {
                flights[year][month] = [];
            }

            entry.getData(
                new zip.TextWriter(), 
                (fileText) => {onFileReadDone(entry.filename, year, month, fileText)}, 
                (current, total) => {onFileReadProgress(entry.filename, current, total)},
            );
        }

        function hideInstructionStage() {
            
        }

        function showUploadStage() {
            
        }

        function toggleInstructionSteps(event) {
            instructionSteps.style.display = instructionSteps.style.display === "block" ? "none" : "block" ;
        }

        function hideUploadStage() {
            introContainer.style.display = "none";
        }

        function onUploadFile(event) {
            fileInput.disabled = true;
            gtag('event', 'on_zip_file_uploaded');
            getEntries(fileInput.files[0], function(entries) {
                var filteredEntries = entries.filter(function(entry) {
                    // e.g. Semantic Location History/2013/2013_SEPTEMBER.json
                    var semanticLocationHistoryFilePattern = /Semantic Location History\/([0-9]{4})\/([0-9]{4})_(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER).json/g;
                    return (entry.filename.match(semanticLocationHistoryFilePattern) !== null);
                });
                // populate the progress map
                filteredEntries.forEach(function(entry) {
                    if (fileProcessProgress[entry.filename] === undefined) {
                        fileProcessProgress[entry.filename] = {
                            readText: 0,
                            processText: false,
                        };
                    }
                });
                filteredEntries.forEach(handleExtractedFile);
            }, onerror);
        }

        function makeDOMInteractive() {
            fileInput.addEventListener('change', onUploadFile, false);
            instructionButton.onclick = toggleInstructionSteps;
        }
        makeDOMInteractive();
    }

    const chartDrawer = {
        // TODO: Move drawers here.
    }

    function presentationStage() {
        const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

        // goal: 50% current emissions from year 2015 to 2030
        var reductionPercentageGoal = 0.0452; // 1 - Math.pow(0.5, 1/(2030 - 2015));
        var totalEmissions = undefined;
        var yearCount = undefined;
        var yearExceededDate = {};
        var annualTotals = {};
        var annualExcess = {};
        
        var selectedYear = getWorstYear();
        var selectedActivity = "FLYING"; // TODO: Get worst year's worst activity.

        var analysisContainer = document.getElementById("analysis-container");
        var yearSelectorContainer = document.getElementById("year-selector-container");
        var activitySelectorContainer = document.getElementById("activity-selector-container");

        // text fields
        var tfYearCount = document.getElementById("year-count");
        var tfHalfTotalEmissions = document.getElementById("half-total-emission");
        var tfExceededDate = document.getElementById("exceeded-date");
        var tfDidExceedAllowance = document.getElementById("did-exceed-allowance");
        var tfDidNotExceedAllowance = document.getElementById("did-not-exceed-allowance");
        var tfExcessCO2 = document.getElementById("excess-co2");

        var totalEmissionsElements = document.getElementsByClassName("total-emission");
        var selectedYearElements = document.getElementsByClassName("selected-year");
        var quarterTotalEmissionsElements = document.getElementsByClassName("quarter-total-emission");

        var map = undefined;

        function showPresentationStage(year, activity) {
            analysisContainer.style.display = "block";
            generateYearSelection();
            generateActivitySelection();
            changeAllText(year);
            drawAllCharts(year);
            drawMap(year, activity);
        }

        function numberWithCommas(x) {
            return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }

        function titleCase(str) {
            var splitStr = str.toLowerCase().split(' ');
            for (var i = 0; i < splitStr.length; i++) {
                splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
            }
            return splitStr.join(' '); 
        }

        function getAverageTotalAnnualEmissions() {
            var years = Object.keys(activityEmissionsByMonth);
            if (years.length > 0) {
                var startAveragingFromYear = 3000;
                for (let i = 0 ; i < years.length; i++) {
                    startAveragingFromYear = parseInt(years[i]) < startAveragingFromYear ? parseInt(years[i]) : startAveragingFromYear;
                }
                if (startAveragingFromYear < 2015) {
                    startAveragingFromYear = 2015;
                } 
                
                var startAveragingFromMonth = 0; // JANUARY
                var firstYearsMonths = Object.keys(activityEmissionsByMonth[startAveragingFromYear]);
                if (firstYearsMonths.length > 1) { // assume that the first month is incomplete
                    if (firstYearsMonths.length < 12) {
                        startAveragingFromMonth = 12 - firstYearsMonths.length + 1; // again, assume that the first month is incomplete
                    }
                    var monthCount = 0;
                    var totalEmissions = 0;
                    // average over every month starting from this one
                    for (let year = startAveragingFromYear; 
                        year <= (new Date()).getUTCFullYear() && activityEmissionsByMonth[year] !== undefined; 
                        year++) {
                        monthCount += Object.keys(activityEmissionsByMonth[year]).length;
                        var yearlyActivities = Object.keys(activityEmissionsByYear[year]);
                        for (let activityIndex = 0; activityIndex < yearlyActivities.length; activityIndex++) {
                            var activityName = yearlyActivities[activityIndex];
                            totalEmissions += activityEmissionsByYear[year][activityName];
                        }
                    }
                    return totalEmissions / monthCount * 12;
                } else {
                    return -1;
                }
            } else {
                return -1;
            }
        }

        function getEmissionsChartData(year) {
            if (dailyEmissionsChart[year] !== undefined) {
                return dailyEmissionsChart[year];
            }
            var dailyEmissions = [];
            var cumulativeEmissions = [];
            var yearEmissions = activityEmissionsByDay[year];
            if (yearEmissions === undefined) {
                console.error("getEmissionsChartData TODO", year);
                return undefined;
            } else {
                var latestDate = new Date(year+1, 0, 1);
                var cumulativeEmissionsSum = 0;
                for (var current = new Date(year, 0, 1); current < latestDate; current.setDate(current.getDate() + 1)) {
                    var monthName = monthNames[current.getMonth()];
                    var monthActivityEmissionsByDay = yearEmissions[monthName];
                    if (monthActivityEmissionsByDay === undefined) {
                        console.warn("this month not in year getEmissionsChartData", year, current.getMonth(), monthName);
                        continue;
                    }
                    var activityEmissionsByMonthDay = monthActivityEmissionsByDay[current.getDate()];
                    if (activityEmissionsByMonthDay !== undefined) {
                        var dayEmissionSum = 0;
                        Object.entries(activityEmissionsByMonthDay).forEach(function (activityEmissionsEntry) {
                            var activityEmissions = activityEmissionsEntry[1];
                            dayEmissionSum += activityEmissions;
                            cumulativeEmissionsSum += activityEmissions;
                        });
                        dailyEmissions.push([new Date(current), Math.round(dayEmissionSum * 10) / 10]);  
                    } 
                    cumulativeEmissions.push([new Date(current), Math.round(cumulativeEmissionsSum * 10) / 10]);
                }
                dailyEmissionsChart[year] = [dailyEmissions, cumulativeEmissions];
                return dailyEmissionsChart[year];
            } 
        }

        function drawCalendarChart(year, isCumulative, chartID) {
            var whichData = isCumulative ? 1 : 0;
            var dataTable = new google.visualization.DataTable();
            dataTable.addColumn({ type: 'date', id: 'Date' });
            dataTable.addColumn({ type: 'number', id: 'Emissions' });
            var chartData = getEmissionsChartData(year)[whichData];
            dataTable.addRows(chartData);

            var chartElement = document.getElementById(chartID);
            var chart = new google.visualization.Calendar(chartElement);

            var options = {
                // title: isCumulative ? "Cumulative Emissions over " + year : "Daily Emissions" ,
                // width: chartElement.parentElement.clientWidth,
                // height: chartElement.parentElement.clientHeight,
                calendar: { cellSize: chartElement.parentElement.clientWidth / 60 },
            };

            if (isCumulative) {
                var emissionBudget = Math.round(getAnnualBudgetAllowance(reductionPercentageGoal, year, getAverageTotalAnnualEmissions()) * 10) / 10;
                var cumulativeMax = Math.round(chartData[chartData.length - 1][1] * 10) / 10;
                if (cumulativeMax < emissionBudget) {
                    cumulativeMax = emissionBudget;
                }
                options.colorAxis = {
                    minValue: 0,  
                    colors: ['#00FF00', '#FFFFFF', '#FF0000'],
                    values: [
                        0, 
                        emissionBudget, 
                        cumulativeMax,
                    ]
                };
            }            

            chart.draw(dataTable, options);
        }

        function drawDonutChart(chartID) {
            var dataTable = new google.visualization.DataTable();
            dataTable.addColumn({ type: 'string', id: 'Activity' });
            dataTable.addColumn({ type: 'number', id: 'Emissions' });
            var annualActivityEmissions = Object.
                entries(activityEmissionsTotals).
                map(function (activityEmissionEntry) {
                return [
                    titleCase((activityEmissionEntry[0] + "").replaceAll("_"," ").replace("IN ", "")), 
                    Math.round(activityEmissionEntry[1] * 10) / 10,
                ];
            });
            dataTable.addRows(annualActivityEmissions);
    
            var chartElement = document.getElementById(chartID)
            var chart = new google.visualization.PieChart(chartElement);

            var options = {
                // width: chartElement.parentElement.clientWidth,
                // height: chartElement.parentElement.clientHeight,
                pieHole: 0.4,
                slices: {
                    0: {offset: 0.1},
                    1: {offset: 0.1},
                    2: {offset: 0.1},
                }
            };

            chart.draw(dataTable, options);
        }

        function drawLineChart(chartID) {
            var dataTable = new google.visualization.DataTable();
            dataTable.addColumn('string', 'Year' );
            dataTable.addColumn('number', 'Annual Emissions' );
            dataTable.addColumn('number', 'Paris Climate Accord Allowance' );
            dataTable.addColumn('number', 'Average USA Emissions Per Capita' );
            dataTable.addColumn('number', 'Average World Emissions Per Capita' );

            var transportationShareOfUSACarbon = 0.28; // https://www.epa.gov/ghgemissions/inventory-us-greenhouse-gas-emissions-and-sinks
            var usaTotalPerCapita = { // https://ourworldindata.org/co2/country/united-states?country=USA
                2010: 18.45,
                2011: 17.88,
                2012: 17.11,
                2013: 17.46,
                2014: 17.49,
                2015: 16.90,
                2016: 16.43,
                2017: 16.21,
                2018: 16.56,
                2019: 16.60, // https://www.wri.org/blog/2019/12/co2-emissions-climb-all-time-high-again-2019-6-takeaways-latest-climate-data
                2020: 15.53, // https://www.statista.com/statistics/193174/us-carbon-dioxide-emissions-per-person-since-2009/
            }
            var transportationShareOfGlobalCarbon = 0.14; // https://www.epa.gov/ghgemissions/global-greenhouse-gas-emissions-data
            var worldTotalPerCapita = { 
                2010: 4.75,
                2011: 4.88,
                2012: 4.90,
                2013: 4.88,
                2014: 4.87,
                2015: 4.81,
                2016: 4.78,
                2017: 4.79,
                2018: 4.79,
                2019: 4.80, // https://www.wri.org/blog/2019/12/co2-emissions-climb-all-time-high-again-2019-6-takeaways-latest-climate-data
                2020: 4.46, // "compared to 2019... a drop of 7% in global emissions." https://www.carbonbrief.org/global-carbon-project-coronavirus-causes-record-fall-in-fossil-fuel-emissions-in-2020
                            // world population increased - https://www.worldometers.info/world-population/world-population-by-year/
            }

            var minYear = (new Date()).getFullYear();
            Object.keys(activityEmissionsByYear).forEach(function(yearKey) {
                minYear = Math.min(minYear, yearKey);
            });

            var latestYear = 2020;
            var annualEmisionsData = [];
            for (var year = minYear; year <= latestYear; year++) {
                var annualSum = null;
                if (activityEmissionsByYear[year] !== undefined) {
                    annualSum = 0;
                    Object.entries(activityEmissionsByYear[year]).forEach(function(yearActivityEntry) {
                        annualSum += yearActivityEntry[1];
                    });
                    annualSum = annualSum / 1000;
                }
                annualEmisionsData.push([
                    year.toString(), 
                    annualSum, 
                    getAnnualBudgetAllowance(reductionPercentageGoal, year, getAverageTotalAnnualEmissions()) / 1000, 
                    usaTotalPerCapita[year] * transportationShareOfUSACarbon,
                    worldTotalPerCapita[year] * transportationShareOfGlobalCarbon,
                ]);
            }
            dataTable.addRows(annualEmisionsData);

            var chartElement = document.getElementById(chartID);
            var chart = new google.charts.Line(chartElement);
            
            var options = {
                legend: {
                    position: 'none'
                },
                vAxis: {
                    title: 'Kilogram tons of CO2'
                }
            };

            chart.draw(dataTable, google.charts.Line.convertOptions(options));
        }

        function drawAllCharts(year) {
            if (activityEmissionsByYear[year] === undefined) {
                console.error("drawAllCharts failed because no data for year", year)
                return;
            }
            google.charts.load("current", {packages:["line", "calendar", "corechart"]});
            google.charts.setOnLoadCallback(() => {
                drawCalendarChart(year, false, 'activity-daily-emissions-chart');
                drawCalendarChart(year, true, 'activity-cumulative-emissions-chart');
                drawDonutChart('total-emissions-donut-chart');
                drawLineChart('annual-emissions-chart');
                window.onresize = () => {
                    // TODO: Complete
                    drawCalendarChart(year, false, 'activity-daily-emissions-chart');
                    drawCalendarChart(year, true, 'activity-cumulative-emissions-chart');
                    drawDonutChart('total-emissions-donut-chart');
                    drawLineChart('annual-emissions-chart');
                };
            });
        }

        function generateYearSelection() {
            Object.entries(activityEmissionsByYear).forEach(function (emissionsYearEntry) {
                var yearSelector = document.createElement("div");
                yearSelector.className = "year-selector";
                yearSelector.id = "year-selector-" + emissionsYearEntry[0];
                yearSelector.innerText = emissionsYearEntry[0];
                yearSelector.onclick = chooseYear;
                yearSelector.setAttribute("year", emissionsYearEntry[0]);
                yearSelectorContainer.appendChild(yearSelector);
            });
        }

        function generateActivitySelection() {
            Object.entries(activityEmissionsTotals).forEach(function (emissionsTotalEntry) {
                var activitySelector = document.createElement("div");
                activitySelector.className = "activity-selector";
                activitySelector.id = "activity-selector-" + emissionsTotalEntry[0];
                activitySelector.onclick = chooseActivity;
                activitySelector.setAttribute("activity", emissionsTotalEntry[0]);

                var selectorImage = document.createElement("img");
                selectorImage.className = "activity-selector-image";
                selectorImage.id = "activity-selector-image-" + emissionsTotalEntry[0];
                selectorImage.setAttribute("activity", emissionsTotalEntry[0]);
                switch (emissionsTotalEntry[0]) {
                    case "FLYING": 
                        selectorImage.src = "./images/plane.svg";
                        break;
                    case "IN_BUS": 
                        selectorImage.src = "./images/bus.svg";
                        break;
                    case "IN_FERRY": 
                        selectorImage.src = "./images/boat.svg";
                        break;
                    case "IN_PASSENGER_VEHICLE": 
                        selectorImage.src = "./images/car.svg";
                        break;
                    case "IN_SUBWAY": 
                        selectorImage.src = "./images/subway.svg";
                        break;
                    case "IN_TRAIN": 
                        selectorImage.src = "./images/train.svg";
                        break;
                    case "MOTORCYCLING": 
                        selectorImage.src = "./images/motorcycle.svg";
                        break;
                }
                activitySelector.appendChild(selectorImage);
                activitySelectorContainer.appendChild(activitySelector);
            });
        }

        function chooseYear(event) {
            gtag('event', 'on_choose_year');
            selectedYear = parseInt(event.target.getAttribute("year"));
            changeAllText(selectedYear);
            drawAllCharts(selectedYear);
            drawMap(selectedYear, selectedActivity);
        }

        function chooseActivity(event) {
            gtag('event', 'on_choose_activity');
            selectedActivity = event.target.getAttribute("activity");
            drawMap(selectedYear, selectedActivity);
        }

        function getYearCount() {
            if (yearCount !== undefined) {
                return yearCount;
            }
            var minimumYear = (new Date()).getFullYear();
            Object.keys(activityEmissionsByYear).forEach(function (yearKey) {
                minimumYear = Math.min(minimumYear, parseInt(yearKey));
            })
            yearCount = (new Date()).getFullYear() - minimumYear;
            return yearCount;
        }

        function getExcessCarbonUsage(year) {
            if (annualExcess[year] !== undefined) {
                return annualExcess[year];
            }
            annualExcess[year] = 0;
            var annualBudgetAllowance = getAnnualBudgetAllowance(reductionPercentageGoal, year, getAverageTotalAnnualEmissions());
            annualExcess[year] = getAnnualTotal(year) - annualBudgetAllowance;
            annualExcess[year] = Math.round( annualExcess[year] * 10) / 10;
            return annualExcess[year];
        }

        function getWorstYear() {
            var worstYear = 0;
            var maxEmissions = 0;
            Object.entries(activityEmissionsByYear).forEach(function(yearActivityEntry) {
                var annualSum = 0;
                Object.entries(yearActivityEntry[1]).forEach(function(activityEntry) {
                    annualSum += activityEntry[1];
                })
                if (maxEmissions <= annualSum) {
                    maxEmissions = annualSum;
                    worstYear = parseInt(yearActivityEntry[0]);
                }
            })
            return worstYear;
        }

        function getTotalEmissions() {
            if (totalEmissions !== undefined) {
                return totalEmissions;
            }
            totalEmissions = 0;
            Object.
                entries(activityEmissionsTotals).
                forEach(function (activityEmissionEntry) {
                    totalEmissions += activityEmissionEntry[1];
                });
            totalEmissions = totalEmissions / 1000;
            totalEmissions = Math.round(totalEmissions * 10) / 10
            return totalEmissions;
        }

        function getExceededDate(year) {
            if (yearExceededDate[year] !== undefined) {
                return yearExceededDate[year];
            }
            var cumulativeEmissionsData = getEmissionsChartData(year)[1];
            var annualAllowance = getAnnualBudgetAllowance(reductionPercentageGoal, year, getAverageTotalAnnualEmissions());
            var exceededDate = null;
            for (var i = 0; i < cumulativeEmissionsData.length; i++) {
                var cumulativeEmissionsDayEntry = cumulativeEmissionsData[i];
                if (cumulativeEmissionsDayEntry[1] > annualAllowance) {
                    exceededDate = cumulativeEmissionsDayEntry[0];
                    break;
                }
            }
            yearExceededDate[year] = exceededDate;
            return exceededDate;
        }

        function getAnnualTotal(year) {
            if (annualTotals[year] !== undefined) {
                return annualTotals[year];
            }
            annualTotals[year] = 0;
            Object.
                entries(activityEmissionsByYear[year]).
                forEach(function (activityEmissions) {
                    annualTotals[year] += activityEmissions[1];
                });
            annualTotals[year] = Math.round( annualTotals[year] * 10) / 10;
            return annualTotals[year];
        }

        function changeAllText(year) {
            tfYearCount.innerText = getYearCount();
            tfHalfTotalEmissions.innerText = numberWithCommas(getTotalEmissions() / 2);
            var exceededDate = getExceededDate(year);
            if (exceededDate === null) {
                tfDidExceedAllowance.style.display = "none";
                tfDidNotExceedAllowance.style.display = "inline";
            } else {
                exceededDate = new Date(exceededDate);
                tfExceededDate.innerText = titleCase(monthNames[exceededDate.getMonth()]) + " " + exceededDate.getDate();
                tfDidExceedAllowance.style.display = "inline";
                tfDidNotExceedAllowance.style.display = "none";
            }
            tfExcessCO2.innerText = getExcessCarbonUsage(year);
            for (var i = 0; i < totalEmissionsElements.length; i++) {
                totalEmissionsElements[i].innerText = numberWithCommas(getTotalEmissions());
            }
            for (var i = 0; i < selectedYearElements.length; i++) {
                selectedYearElements[i].innerText = year;
            }
            for (var i = 0; i < quarterTotalEmissionsElements.length; i++) {
                quarterTotalEmissionsElements[i].innerText = numberWithCommas(getTotalEmissions() / 4);
            }
        }

        function drawMap(year, activityType) {
            if (map === undefined) {
                map = L.map('map').setView([0, 0], 1);
                var tiles = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
                    minZoom: 1
                }).addTo(map);
            } else {
                // TODO: Also check if the year and selectedType are different from how they were, otherwise no need to refresh
                map.eachLayer(function(layer){
                    if (layer._url === undefined) {
                        map.removeLayer(layer);
                    }
                });
            }
            switch (activityType) {
                case "FLYING": 
                case "IN_TRAIN":
                    var polygroup = mapDataByYear[year][activityType];
                    if (polygroup !== undefined) {
                        polygroup.addTo(map);
                    }
                    break;
                case "IN_BUS":
                case "IN_FERRY":
                case "IN_PASSENGER_VEHICLE":
                case "IN_SUBWAY":
                case "MOTORCYCLING":
                    var heatLayer = mapDataByYear[year][activityType];
                    if (heatLayer !== undefined) {
                        heatLayer.addTo(map);
                    }
                    break;
            }
        }

        function getAnnualBudgetAllowance(reductionPercentageGoal, currentYear, annualEmissionsAverage) {
            return annualEmissionsAverage * Math.pow((1 - reductionPercentageGoal),(currentYear - 2015 + 1));
        }

        showPresentationStage(selectedYear, selectedActivity);        
    }

})(this);