(function(obj) {
	var requestFileSystem = obj.webkitRequestFileSystem || obj.mozRequestFileSystem || obj.requestFileSystem;
	var activityEmissionsByDay = {};
	var activityEmissionsByMonth = {};
	var activityEmissionsByYear = {};
	var activityEmissionsTotals = {};
	var fileProcessProgress = {};
	var earliestRecordedDate = 0;
	var firstCompleteYear = 0;
	var lastCompleteYear = 0;
    var totalEmissions = 0;

    var dailyEmissionsChart = {};

    uploadStage();

    function uploadStage() {
        // interactive document elements
        var fileInput = document.getElementById("file-input");
        var fileProgressMeter = document.getElementById("upload-progress-bar");

        // passive document elements
        var introContainer = document.getElementById("intro-container");

        var flights = {}; // TODO: Rename to flightPathsByYear and populate during processSegment(); perhaps make another function with switch statements to compile annual points/paths for mapping later.
        var history = {};

        function onerror(message) {
            console.log(message);
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

                if (activityType == "FLYING") {
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

                        // create a red polyline from an array of LatLng points
                        if (Number.isNaN(startLatitude) || Number.isNaN(startLongitude) || Number.isNaN(endLatitude) || Number.isNaN(endLongitude)) {
                            console.log(segment);
                            // TODO: Handle this case
                        } else {
                            var latlngs = [
                                [startLatitude, startLongitude],
                                [endLatitude, endLongitude]
                            ];
                            flights[year][month].push(latlngs);
                            // if (year === "2019")
                            // 	var polyline = L.polyline(latlngs, {color: 'red'}).addTo(map);
                        }
                        

                    } else {

                    }
                }
            } else if (segment?.placeVisit) {

            } else {
            }

        }  

        function onAllFilesProcessed() {
            console.log("All files processed.", 
                fileProcessProgress, 
                activityEmissionsByDay,
                activityEmissionsByMonth, 
                activityEmissionsByYear,
                activityEmissionsTotals, 
                flights);

            // TODO: Cleanup DOM and replace with new DOM. 
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

        function hideUploadStage() {
            introContainer.style.display = "none";
        }

        function onUploadFile(event) {
            console.log(event);
            fileInput.disabled = true;
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
        }
        makeDOMInteractive();
    }

    const chartDrawer = {
        // TODO: Move drawers here.
    }

    function presentationStage() {
        // goal: 50% current emissions from year 2015 to 2030
        var reductionPercentageGoal = 0.0452; // 1 - Math.pow(0.5, 1/(2030 - 2015));
        var selectedYear = getWorstYear();

        var analysisContainer = document.getElementById("analysis-container");
        var yearSelectorContainer = document.getElementById("year-selector-container");
        
        console.log(
            getAverageTotalAnnualEmissions(),
            getEmissionsChartData(2020),
        );

        function showPresentationStage(year) {
            analysisContainer.style.display = "grid";
            generateYearSelection();
            drawAllCharts(year);
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
            // const monthMap = {"JANUARY": 0, "FEBRUARY": 1, "MARCH": 2, "APRIL": 3, "MAY": 4, "JUNE": 5, "JULY": 6, "AUGUST": 7, "SEPTEMBER": 8, "OCTOBER": 9, "NOVEMBER": 10, "DECEMBER": 11};
            const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

            var dailyEmissions = [];
            var cumulativeEmissions = [];
            var yearEmissions = activityEmissionsByDay[year];
            if (yearEmissions === undefined) {
                console.error("getEmissionsChartData TODO", year);
                return undefined;
            } else {
                var latestDate = new Date(year+1, 0, 1);
                console.log(latestDate);
                var cumulativeEmissionsSum = 0;
                for (var current = new Date(year, 0, 1); current < latestDate; current.setDate(current.getDate() + 1)) {
                    var monthName = monthNames[current.getMonth()];
                    var monthActivityEmissionsByDay = yearEmissions[monthName];
                    if (monthActivityEmissionsByDay === undefined) {
                        // console.warn("this month not in year getEmissionsChartData", year, current.getMonth(), monthName);
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
                title: isCumulative ? "Cumulative Emissions over " + year : "Daily Emissions" ,
                width: chartElement.parentElement.clientWidth,
                height: chartElement.parentElement.clientHeight,
                calendar: { cellSize: chartElement.parentElement.clientWidth / 60 },
            };

            if (isCumulative) {
                var emissionBudget = Math.round(getAnnualBudgetAllowance(reductionPercentageGoal, year, getAverageTotalAnnualEmissions()) * 10) / 10;
                var cumulativeMax = Math.round(chartData[chartData.length - 1][1] * 10) / 10;
                if (cumulativeMax < emissionBudget) {
                    cumulativeMax = emissionBudget;
                }
                // console.log("emissionBudget, cumulativeMax", emissionBudget, cumulativeMax);
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

        function titleCase(str) {
            var splitStr = str.toLowerCase().split(' ');
            for (var i = 0; i < splitStr.length; i++) {
                splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
            }
            return splitStr.join(' '); 
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
                    activityEmissionEntry[1]];
            });
            dataTable.addRows(annualActivityEmissions);
    
            var chartElement = document.getElementById(chartID)
            var chart = new google.visualization.PieChart(chartElement);

            var options = {
                pieHole: 0.4,
            };

            chart.draw(dataTable, options);
        }

        function drawLineChart(chartID) {
            var dataTable = new google.visualization.DataTable();
            dataTable.addColumn({ type: 'string', id: 'Year' });
            dataTable.addColumn({ type: 'number', id: 'Annual Emissions' });
            dataTable.addColumn({ type: 'number', id: 'Annual Allowance' });
            dataTable.addColumn({ type: 'number', id: 'Average Developed World Emissions' });
            dataTable.addColumn({ type: 'number', id: 'Average Emissions Per Capita' });

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
            var worldTotalPerCapita = { // https://ourworldindata.org/co2/country/united-states?country=USA
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

            var annualEmisionsData = Object.entries(activityEmissionsByYear).map(function(yearEntry) {
                var annualSum = 0;
                Object.entries(yearEntry[1]).forEach(function(yearActivityEntry) {
                    annualSum += yearActivityEntry[1];
                });
                return [
                    yearEntry[0], 
                    annualSum / 1000, 
                    getAnnualBudgetAllowance(reductionPercentageGoal, yearEntry[0], getAverageTotalAnnualEmissions()) / 1000, 
                    usaTotalPerCapita[parseInt(yearEntry[0])] * transportationShareOfUSACarbon,
                    worldTotalPerCapita[parseInt(yearEntry[0])] * transportationShareOfGlobalCarbon,
                ];
            });
            dataTable.addRows(annualEmisionsData);

            var chartElement = document.getElementById(chartID);
            var chart = new google.visualization.LineChart(chartElement);

            var options = {
            };

            chart.draw(dataTable, options);
        }

        function drawAllCharts(year) {
            console.log("drawAllCharts", year);
            if (activityEmissionsByYear[year] === undefined) {
                console.error("drawAllCharts failed because no data for year", year)
                return;
            }
            google.charts.load("current", {packages:["calendar", "corechart"]});
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
            // TODO: finish
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

        function chooseYear(event) {
            selectedYear = parseInt(event.target.innerHTML);
            // console.log(selectedYear);
            drawAllCharts(selectedYear);
            changeAllText(selectedYear);
        }

        function changeAllText() {

        }

        function chooseActivity(event) {

        }

        function getExcessCarbonUsage() {
            
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

        function drawMap() {

        }

        function getAnnualBudgetAllowance(reductionPercentageGoal, currentYear, averageAnnualEmissions) {
            return averageAnnualEmissions * Math.pow((1 - reductionPercentageGoal),(currentYear - 2015 + 1));
        }

        showPresentationStage(selectedYear);        
    }

})(this);