(function(obj) {
    var timeIndexJSLoaded = performance.now()
    var timeZipFileSelected = undefined;
    var timeAllFilesProcessed = undefined;

	var requestFileSystem = obj.webkitRequestFileSystem || obj.mozRequestFileSystem || obj.requestFileSystem;
	var activityEmissionsByDay = {};
	var activityEmissionsByMonth = {};
    var activityEmissionsByYear = {};
    var activityDistancesByYear = {};
	var activityEmissionsTotals = {};
    var fileProcessProgress = {};
    var yearsAndMonths = {};

    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const monthNums = {"JANUARY": 0, "FEBRUARY": 1, "MARCH": 2, "APRIL": 3, "MAY": 4, "JUNE": 5, "JULY": 6, "AUGUST": 7, "SEPTEMBER": 8, "OCTOBER": 9, "NOVEMBER": 10, "DECEMBER": 11};

    var mapDataByYear = {};

    var dailyEmissionsChart = {};

    importStage();

    function importStage() {
        // interactive document elements
        var fileInput = document.getElementById("file-input");
        var fileProgressMeter = document.getElementById("import-progress-bar"); 
        var introductionSection = document.getElementById("introduction-view-section");
        var introButtonLearnMore = document.getElementById("main-view-button-learn-more");
        var introButtonStart = document.getElementById("main-view-button-start");
        var introButtonStart2 = document.getElementById("main-view-button-start-2");

        var aboutViewSections = document.getElementsByClassName("about-view-section");
        var aboutBackButton = document.getElementById("main-view-button-about-back");
        var aboutButtonDefault = document.getElementById("question-button-default");
        var aboutButtonPrivacy = document.getElementById("question-button-privacy");
        var aboutButtonContribute = document.getElementById("question-button-contribute");
        var aboutButtonCalculation = document.getElementById("question-button-calculation");
        var aboutTextDefault = document.getElementById("about-text-default");
        var aboutTextPrivacy = document.getElementById("about-text-privacy");
        var aboutTextCalculation = document.getElementById("about-text-calculation");
        var aboutTextContribute = document.getElementById("about-text-contribute");

        var importViewSections = document.getElementsByClassName("import-view-section");
        var importBackButton = document.getElementById("main-view-button-import-back");
        var importProgressContainer = document.getElementById("import-progress-container");
        var importProgressIndicatorComponents = {};
        var importErrorContainer = document.getElementById("import-error-container");
        var importErrorElementsList = document.getElementById("import-errors-list");
        
        var didImportError = false;
        var importErrors = {};

        var history = {};

        function onError(error, semanticError, yearString, monthName, fileName) {
            didImportError = true;
            if (yearString && monthName) {
                if (importErrors[yearString] === undefined) {
                    importErrors[yearString] = {};
                }
                if (importErrors[yearString][monthName] === undefined) {
                    importErrors[yearString][monthName] = [];
                }
                importErrors[yearString][monthName].push({
                    error: error,
                    semanticError: semanticError, 
                });

                if (importProgressIndicatorComponents[yearString][monthName] !== undefined) {
                    importProgressIndicatorComponents[yearString][monthName].style.backgroundColor = "rgb(210, 110, 110)";
                }

                if (fileProcessProgress[yearString] !== undefined &&
                    fileProcessProgress[yearString][monthName] !== undefined) {
                    fileProcessProgress[yearString][monthName].processText = true;
                }
            }
            if (yearString) {

            } 
        }

        function getEntries(file, onend) {
            zip.workerScriptsPath = "./lib/";
            zip.createReader(new zip.BlobReader(file), function(zipReader) {
                zipReader.getEntries(onend);
            }, onError);
        }

        function areAllFilesProcessed() {
            var allProcessed = true;
            Object.entries(fileProcessProgress).forEach(function(progressYearEntry) {
                Object.entries(progressYearEntry[1]).forEach(function(progressMonthEntry) {
                    allProcessed = allProcessed && progressMonthEntry[1].processText;
                });
            })
            return allProcessed;
        }

        // UK Department for Business, Energy, and Industrial Strategy - 2019 Government greenhouse gas conversion factors for company reporting
        // https://assets.publishing.service.gov.uk/government/imports/system/imports/attachment_data/file/904215/2019-ghg-conversion-factors-methodology-v01-02.pdf
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

        function processSegment (segment, index, yearString, monthName) {
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

                    if (activityDistancesByYear[yearString][activityType] === undefined) {
                        activityDistancesByYear[yearString][activityType] = distance;
                    } else {
                        activityDistancesByYear[yearString][activityType] += distance;
                    }
        
                    if (activityEmissionsByYear[yearString][activityType] === undefined) {
                        activityEmissionsByYear[yearString][activityType] = activityEmissions;
                    } else {
                        activityEmissionsByYear[yearString][activityType] += activityEmissions;
                    }
        
                    if (activityEmissionsByMonth[yearString][monthName][activityType]) {
                        activityEmissionsByMonth[yearString][monthName][activityType] += activityEmissions;
                    } else {
                        activityEmissionsByMonth[yearString][monthName][activityType] =  activityEmissions;
                    }
        
                    if (segment.activitySegment.duration && 
                        segment.activitySegment.duration.startTimestampMs) {
                        var date = (new Date(parseInt(segment.activitySegment.duration.startTimestampMs))).getDate()
                        if (activityEmissionsByDay[yearString][monthName][date] === undefined) {
                            activityEmissionsByDay[yearString][monthName][date] = {};
                        } 
                        if (activityEmissionsByDay[yearString][monthName][date][activityType] === undefined) {
                            activityEmissionsByDay[yearString][monthName][date][activityType] = activityEmissions;
                        } else {
                            activityEmissionsByDay[yearString][monthName][date][activityType] += activityEmissions;
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
                        if (mapDataByYear[yearString] === undefined) {
                            mapDataByYear[yearString] = {};
                        }
                        switch (activityType) {
                            case "FLYING": 
                            case "IN_TRAIN":
                                if (mapDataByYear[yearString][activityType] === undefined) {
                                    mapDataByYear[yearString][activityType] = L.layerGroup();
                                }
                                var sdLatLongs = [
                                    [startLatitude, startLongitude],
                                    [endLatitude, endLongitude]
                                ];
                                var polyline = L.polyline(sdLatLongs, {color: 'red'});
                                mapDataByYear[yearString][activityType].addLayer(polyline);
                                break;
                            case "IN_BUS":
                            case "IN_FERRY":
                            case "IN_PASSENGER_VEHICLE":
                            case "IN_SUBWAY":
                            case "MOTORCYCLING":
                                if (mapDataByYear[yearString][activityType] === undefined) {
                                    mapDataByYear[yearString][activityType] = L.heatLayer([], {
                                            radius: 20,
                                            blur: 12,
                                            gradient: {0.3: 'red', 0.8: 'orange', 1: 'yellow'},
                                        });
                                } else {
                                    mapDataByYear[yearString][activityType].addLatLng(
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
            console.log(didImportError);
            console.log(importErrors);
            if (didImportError) {
                showImportErrors();
            } else {
                hideImportStage();
                presentationStage();
            }
            timeAllFilesProcessed = performance.now();
            gtag("event", "timing_complete", {
                name: 'on_all_files_processed',
                value: timeAllFilesProcessed - timeZipFileSelected,
                event_category: 'from_import_to_analysis',
            });
        }  

        function getTotalReadFileProgress() {
            var totalProgress = 0;
            var keys = 0;
            Object.entries(fileProcessProgress).forEach(function(progressYearEntry) {
                Object.entries(progressYearEntry[1]).forEach(function(progressMonthEntry) {
                    totalProgress += progressMonthEntry[1].readText;
                    keys++;
                });
            })
            return totalProgress / keys;
        }

        function onFileReadDone(fileName, yearString, monthName, fileText) {
            try {
                var parsedSemanticHistory = JSON.parse(fileText);
                history[fileName] = parsedSemanticHistory; // TODO: Potentially remove.
                if (parsedSemanticHistory === undefined) {
                    var errorMessage = "The JSON file for " + monthName + " " + yearString + " is parseable but unusable.";
                    onError(null, errorMessage, yearString, monthName, fileName);
                    return;
                }
                if (parsedSemanticHistory.timelineObjects) {
                    parsedSemanticHistory.timelineObjects.forEach(function(segment, index) { 
                        processSegment(segment, index, yearString, monthName);
                    });
                    fileProcessProgress[yearString][monthName].processText = true;
                    gtag('event', 'on_file_processed', {
                        year: yearString,
                        month: monthName,
                    }); 
                } else {
                    var errorMessage = "The JSON file for " + monthName + " " + yearString + " does not contain timelineObjects.";
                    onError(null, errorMessage, yearString, monthName, fileName);
                }
            } catch(jsonParseError) {
                fileProcessProgress[yearString][monthName].failure = true;
                var errorMessage = "The file for " + monthName + " " + yearString + " is not valid JSON.";
                onError(jsonParseError, errorMessage, yearString, monthName, fileName);
            }
            if (areAllFilesProcessed()) {
                onAllFilesProcessed();
            }
        }
        
        // onFileReadProgress - onprogress callback
        function onFileReadProgress(yearString, monthName, current, total) {
            fileProcessProgress[yearString][monthName].readText = current / total;
            fileProcessProgress[yearString][monthName].processText = false;
            var RB = 210 - Math.ceil(100 * current / total);
            var progressIndicatorColorRGB = "rgb(" + RB + ", 210, " + RB + ")";
            importProgressIndicatorComponents[yearString][monthName].style.backgroundColor = progressIndicatorColorRGB;
            fileProgressMeter.style.width = getTotalReadFileProgress()*100 + "%";
        }

        function handleExtractedFile(entry, index) {	
            // populate activityEmissions objects		
            var pathComponents = entry.filename.split("/");
            var yearString = pathComponents[pathComponents.length - 2]; // string
            var monthName = pathComponents[pathComponents.length - 1].split("_")[1].split(".")[0]; // after the '20XX_' and before the '.json'

            if (activityEmissionsByYear[yearString] === undefined) {
                activityEmissionsByYear[yearString] = {};
            }

            if (activityDistancesByYear[yearString] === undefined) {
                activityDistancesByYear[yearString] = {};
            }

            if (activityEmissionsByMonth[yearString] === undefined) {
                activityEmissionsByMonth[yearString] = {};
            }
            if (activityEmissionsByMonth[yearString][monthName] === undefined) {
                activityEmissionsByMonth[yearString][monthName] = {};
            }

            if (activityEmissionsByDay[yearString] === undefined) {
                activityEmissionsByDay[yearString] = {};
            }
            if (activityEmissionsByDay[yearString][monthName] === undefined) {
                activityEmissionsByDay[yearString][monthName] = {};
            }


            entry.getData(
                new zip.TextWriter(), 
                (fileText) => {onFileReadDone(entry.filename, yearString, monthName, fileText)}, 
                (current, total) => {onFileReadProgress(yearString, monthName, current, total)},
            );
        }

        function generateImportProgress(filteredEntries) {
            var importWarningElement = document.createElement("div");
            importWarningElement.innerHTML = "Do not change tabs or press back. Even if the page seems to freeze, the import should only take a maximum of 2 minutes.";
            importProgressContainer.prepend(importWarningElement);

            // populate the progress map
            filteredEntries.forEach(function(entry) {
                var pathComponents = entry.filename.split("/");
                var yearString = pathComponents[pathComponents.length - 2]; // string
                var monthName = pathComponents[pathComponents.length - 1].split("_")[1].split(".")[0]; // after the '20XX_' and before the '.json'
                if (fileProcessProgress[yearString] === undefined) {
                    fileProcessProgress[yearString] = {};
                }
                if (fileProcessProgress[yearString][monthName] === undefined) {
                    fileProcessProgress[yearString][monthName] = {
                        readText: 0,
                        processText: false,
                        fileName: entry.filename,
                        failure: false,
                    };
                }
                if (yearsAndMonths[yearString] === undefined) {
                    yearsAndMonths[yearString] = {};
                }
                if (yearsAndMonths[yearString][monthName] === undefined) {
                    yearsAndMonths[yearString][monthName] = true;
                }
            })
            var yearStrings = Object.keys(fileProcessProgress);
            yearStrings.sort(function (a, b) {
                return ('' + a.attr).localeCompare(b.attr);
            });
            var earliestYear = parseInt(yearStrings[0]);
            var latestYear = (new Date()).getFullYear();

            for (var year = earliestYear; year <= latestYear; year++) {
                var yearString = year + "";
                var importProgressYearContainer = document.createElement("div");
                importProgressYearContainer.className = "import-progress-year-container";
                importProgressYearContainer.id = "import-progress-year-container-" + yearString;
                for (var j = 0; j < 12; j++) {
                    var importProgressMonthContainer = document.createElement("div");
                    importProgressMonthContainer.className = "import-progress-month-container";
                    importProgressMonthContainer.id = "import-progress-month-container-" + yearString + "-" + j;
                    
                    var importProgressMonthIndicator = document.createElement("div");
                    importProgressMonthIndicator.classList.add("import-progress-month-indicator");
                    importProgressMonthIndicator.classList.add("month-missing");
                    importProgressMonthIndicator.id = "import-progress-month-indicator-" + yearString + "-" + j;

                    var monthName = monthNames[j];
                    if (fileProcessProgress[yearString] !== undefined && 
                        fileProcessProgress[yearString][monthName] !== undefined) {
                        importProgressMonthIndicator.classList.remove("month-missing");
                    }
                    
                    importProgressMonthContainer.appendChild(importProgressMonthIndicator);

                    if (j < 11) {
                        var importProgressMonthSpacer = document.createElement("div");
                        importProgressMonthSpacer.className = "import-progress-month-spacer";
                        importProgressMonthSpacer.id = "import-progress-month-spacer-" + yearString + "-" + j;
                        importProgressMonthContainer.appendChild(importProgressMonthSpacer);
                    }
                    
                    importProgressYearContainer.appendChild(importProgressMonthContainer);
                    if (importProgressIndicatorComponents[yearString] === undefined) {
                        importProgressIndicatorComponents[yearString] = {};
                    }
                    importProgressIndicatorComponents[yearString][monthName] = importProgressMonthIndicator;
                }
                importProgressContainer.appendChild(importProgressYearContainer);
            }
        }

        function showImportErrors() {
            console.log(importErrors);
            // remove any pre-existing error components
            while (importErrorElementsList.firstChild) {
                importErrorElementsList.removeChild(importErrorElementsList.firstChild);
            }
            var importErrors = [];
            // generate error components
            Object.entries(importErrors).forEach(function(importErrorYearEntry) {
                Object.entries(importErrorYearEntry[1]).forEach(function(importErrorMonthEntry) {
                    var errorList = importErrorMonthEntry[1];
                    errorList.forEach(function(errorListItem) {
                        var errorElement = document.createElement("li");
                        errorElement.className = "import-error-element";
                        errorElement.id = "import-error-element-" + importErrorYearEntry[0] + "-" + importErrorMonthEntry[0];
                        var errorElementMessage = document.createElement("div");
                        errorElementMessage.className = "import-error-element-text";
                        errorElementMessage.id = "import-error-element-text-"  + importErrorYearEntry[0] + "-" + importErrorMonthEntry[0];
                        errorElementMessage.innerText = errorListItem.semanticError;
                        importErrors.push(errorListItem.semanticError);
                        errorElement.appendChild(errorElementMessage);
                        importErrorElementsList.appendChild(errorElement);
                    });
                });
            })
            gtag('event', 'on_show_import_errors', {
                importErrors: importErrors,
            });
            importErrorContainer.style.display = "block";
        }

        function showIntroductionStage() {
            introductionSection.style.display = "flex";
            gtag('event', 'on_show_introduction_stage');
        }

        function hideIntroductionStage() {
            introductionSection.style.display = "none";
        }

        function showQuestionStage() {
            for (var i = 0; i < aboutViewSections.length; i++) {
                aboutViewSections[i].style.display = "block";
            }
            gtag('event', 'on_show_question_stage');
        }

        function handleAboutButtonClick(event, whichQuestion) {
            aboutTextDefault.style.display = "none";
            aboutTextPrivacy.style.display = "none";
            aboutTextContribute.style.display = "none";
            aboutTextCalculation.style.display = "none";

            aboutButtonDefault.classList.remove("selected");
            aboutButtonPrivacy.classList.remove("selected");
            aboutButtonContribute.classList.remove("selected");
            aboutButtonCalculation.classList.remove("selected");

            switch(whichQuestion) {
                case "default":
                    aboutButtonDefault.classList.add("selected");
                    aboutTextDefault.style.display = "block";
                    break;
                case "privacy":
                    aboutButtonPrivacy.classList.add("selected");
                    aboutTextPrivacy.style.display = "block";
                    break;
                case "contribute":
                    aboutButtonContribute.classList.add("selected");
                    aboutTextContribute.style.display = "block";
                    break;
                case "calculation":
                    aboutButtonCalculation.classList.add("selected");
                    aboutTextCalculation.style.display = "block";
                    break;
            }
            gtag('event', 'on_question_button_click', {
                whichQuestion: whichQuestion,
            });
        }

        function hideQuestionStage() {
            for (var i = 0; i < aboutViewSections.length; i++) {
                aboutViewSections[i].style.display = "none";
            }
        }

        function showImportStage() {
            for (var i = 0; i < aboutViewSections.length; i++) {
                importViewSections[i].style.display = "block";
            }
            gtag('event', 'on_show_import_stage');
        }

        function hideImportStage() {
            for (var i = 0; i < aboutViewSections.length; i++) {
                importViewSections[i].style.display = "none";
            }
        }

        function onEntriesExtracted(entries) {
            // filter the files that aren't history related
            var filteredEntries = entries.filter(function(entry) {
                // e.g. Semantic Location History/2013/2013_SEPTEMBER.json
                var semanticLocationHistoryFilePattern = /Semantic Location History\/([0-9]{4})\/([0-9]{4})_(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER).json/g;
                return (entry.filename.match(semanticLocationHistoryFilePattern) !== null);
            });
            generateImportProgress(filteredEntries);
            gtag('event', 'on_entries_extracted', {
                filteredEntriesCount: filteredEntries.length,
                yearsAndMonths: yearsAndMonths,
            })
            filteredEntries.forEach(handleExtractedFile);
        }

        function onImportFile(event) {
            fileInput.disabled = true;
            timeZipFileSelected = performance.now();
            gtag("event", "timing_complete", {
                name: 'on_file_selected',
                value: timeAllFilesProcessed - timeIndexJSLoaded,
                event_category: 'from_import_to_analysis',
            });
            getEntries(fileInput.files[0], onEntriesExtracted, onError);
        }

        function makeDOMInteractive() {
            fileInput.addEventListener('change', onImportFile, false);
            // instructionButton.onclick = toggleInstructionSteps;

            aboutButtonDefault.onclick = (e) => {handleAboutButtonClick(e, "default")};
            aboutButtonPrivacy.onclick = (e) => {handleAboutButtonClick(e, "privacy")};
            aboutButtonContribute.onclick = (e) => {handleAboutButtonClick(e, "contribute")};
            aboutButtonCalculation.onclick = (e) => {handleAboutButtonClick(e, "calculation")};

            introButtonLearnMore.onclick = () => {
                hideIntroductionStage();
                showQuestionStage();
            }
            introButtonStart.onclick = () => {
                hideIntroductionStage();
                showImportStage();
            }
            introButtonStart2.onclick = () => {
                hideQuestionStage();
                showImportStage();
            }
            aboutBackButton.onclick = () => {
                hideQuestionStage();
                showIntroductionStage();
            }
            importBackButton.onclick = () => {
                hideImportStage();
                showQuestionStage();
            }
        }
        makeDOMInteractive();
        google.charts.load("current", {packages:["line", "calendar", "corechart"]});
    }

    const chartDrawer = {
        // TODO: Move drawers here.
    }

    function presentationStage() {
        // goal: 50% current emissions from year 2015 to 2030
        var reductionPercentageGoal = 0.0452; // 1 - Math.pow(0.5, 1/(2030 - 2015));
        var totalEmissions = undefined;
        var yearCount = undefined;
        var yearExceededDate = {};
        var annualTotals = {};
        var annualExcess = {};
        var yearMaxDayAndEmissions = {};
        
        var selectedScope = "overall";
        var selectedOverallChart = "donate";
        var selectedAnnualChart = "donate";
        var selectedYear = getWorstYear();
        var selectedActivity = "FLYING"; // TODO: Get worst year's worst activity.

        var presentationSections = document.getElementsByClassName("presentation-view-section");

        var scopeSelectorContainer = document.getElementById("scope-control-panel-selector-container");
        var chevronElement = document.getElementById("control-panel-chevron");
        var chartSelectorContainer = document.getElementById("chart-view-control-panel-selector-container");
        var yearSelectorContainer = document.getElementById("year-control-panel-selector-container");
        var activitySelectorContainer = document.getElementById("actvity-control-panel-selector-container");

        var scopeButtons = document.getElementsByClassName("scope-control-panel-selector");
        var chartButtons = document.getElementsByClassName("chart-view-control-panel-selector");
        
        var activitySelectors = document.getElementsByClassName("activity-control-panel-selector");

        var overallDonutChartLegendContainer = document.getElementById("overall-emissions-donut-chart-legend-container");
        var overallLineChartLegendContainer = document.getElementById("overall-emissions-line-chart-legend-container");
        var annualEmissionsCalendarChartLegendsContainer = document.getElementById("annual-emissions-calendar-charts-legend-container");
        var donationCallToAction = document.getElementById("donation-call-to-action");
        var annualEmissionsByActivityMapContainer = document.getElementById("annual-emissions-by-activity-map-container");

        var emissionsBreakdown = document.getElementById("emissions-breakdown");
        
        var overallEmissionsDonutChartContainer = document.getElementById("overall-emissions-donut-chart-container");
        var overallEmissionsLineChartContainer = document.getElementById("overall-emissions-line-chart-container");
        var annualEmissionsCalendarChartsContainer = document.getElementById("annual-emissions-calendar-charts-container");
        var overallEmissionsLineChart = undefined;
        var overallEmissionsDonutChart = undefined;
        var annualEmissionsCalendarDailyChart = undefined;
        var annualEmissionsCalendarCumulativeChart = undefined;
        var mapID = "annual-emissions-by-activity-map";
        var annualEmissionsByActivityMap = undefined;

        // overall text fields
        var tfYearCount = document.getElementById("year-count");
        var tfHalfTotalEmissions = document.getElementById("half-total-emission");
        var quarterTotalEmissionsElements = document.getElementsByClassName("quarter-total-emission");
        var totalEmissionsElements = document.getElementsByClassName("total-emission");
        var earliestYearElements = document.getElementsByClassName("earliest-year");
        var donationCalculationElements = document.getElementsByClassName("donation-calculation");

        // annual text fields
        var tfExceededDate = document.getElementById("exceeded-date");
        var tfDidExceedAllowance = document.getElementById("did-exceed-allowance");
        var tfDidNotExceedAllowance = document.getElementById("did-not-exceed-allowance");
        var tfExcessCO2 = document.getElementById("excess-co2");
        var yearMaxDayElements = document.getElementsByClassName("year-max-day");
        var yearMaxEmissionsElements = document.getElementsByClassName("year-max-kg");
        var selectedYearElements = document.getElementsByClassName("selected-year");

        // annual activity text fields
        var tfAnnualEmissionsByActivityMapLabel = document.getElementById("annual-emissions-by-activity-map-label");

        // https://www.epa.gov/greenvehicles/fast-facts-transportation-greenhouse-gas-emissions
        // https://www.epa.gov/greenvehicles/archives-fast-facts-us-transportation-sector-greenhouse-gas-emissions
        var usaTotalPersonalTransportationPerCapita = { 
            2010: 4.226056654,
            2011: 4.2415522,
            2012: 4.179033768,
            2013: 3.999361088,
            2014: 4.027634424,
            2015: 3.948225731,
            2016: 3.975654518,
            2017: 3.953430532,
            2018: 3.979868128,
            2019: null,
            2020: 3.527810416, // "we estimate that net economy-wide US GHG emissions fell by 10.3% in 2020" - https://rhg.com/research/preliminary-us-emissions-2020
        }

        function showPresentationStage() {
            for (var i = 0; i < presentationSections.length; i++) {
                presentationSections[i].style.display = "block";
            }
            for (var i = 0; i < activitySelectors.length; i++) {
                activitySelectors[i].onclick = chooseActivity;
            }
            for (var i = 0; i < scopeButtons.length; i++) {
                scopeButtons[i].onclick = (event) => {
                    var scope = event.target.getAttribute("scope");
                    chooseScope(scope);
                    gtag('event', 'on_choose_scope', {
                        scope: scope,
                        year: selectedYear,
                        activity: selectedActivity,
                        overallChart: selectedOverallChart,
                        annualChart: selectedAnnualChart,
                    });
                };
            }
            for (var i = 0; i < chartButtons.length; i++) {
                chartButtons[i].onclick = (event) => {chooseChart(event.target.getAttribute("chartname"));};
            }
            scopeSelectorContainer.style.display = "grid";
            chevronElement.style.display = "flex";
            chartSelectorContainer.style.display = "grid";

            generateYearSelection();
            changeOverallText()
            chooseYear(selectedYear);
            gtag('event', 'on_show_presentation_stage');
            // changeAllText(year);
            // drawAllCharts(year);
            // drawMap(year, activity);
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

        // getUSAATPTE2010To2015 - get USA Average Total Personal Transportation Emissions from 2010 - 2015 
        function getUSAATPTE2010To2015() {
            var total2010to2015 = 0;
            for (var year = 2010; year <= 2015; year++) {
                total2010to2015 += usaTotalPersonalTransportationPerCapita[year];
            }
            return total2010to2015 / 6;
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
                    cumulativeEmissions.push([new Date(current), Math.round(cumulativeEmissionsSum / 1000 * 10) / 10]);
                }
                dailyEmissionsChart[year] = [dailyEmissions, cumulativeEmissions];
                return dailyEmissionsChart[year];
            } 
        }

        function drawCalendarChart(year, isCumulative, chartID) {
            if (isCumulative){
                if (annualEmissionsCalendarCumulativeChart !== undefined) {
                    console.log("already loaded annualEmissionsCalendarCumulativeChart")
                    return
                }
            } else {
                if (annualEmissionsCalendarDailyChart !== undefined) {
                    console.log("already loaded annualEmissionsCalendarDailyChart")
                    return
                }
            }
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
                var emissionBudget = Math.round(getAnnualBudgetAllowance(reductionPercentageGoal, year, getUSAATPTE2010To2015()) * 10) / 10;
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
            } else {
                options.colorAxis = {
                    minValue: 0,  
                    colors: ['#FFFFFF', '#e69900'],
                };
            }       

            chart.draw(dataTable, options);
        }

        function drawDonutChart(chartID) {
            if (overallEmissionsDonutChart !== undefined) {
                console.log("already loaded overallEmissionsDonutChart")
                return;
            }
            var dataTable = new google.visualization.DataTable();
            dataTable.addColumn({ type: 'string', id: 'Activity' });
            dataTable.addColumn({ type: 'number', id: 'Emissions' });
            var annualActivityEmissions = Object.
                entries(activityEmissionsTotals).
                map(function (activityEmissionEntry) {
                return [
                    getFormattedActivityType(activityEmissionEntry[0] + ""),
                    Math.round(activityEmissionEntry[1] / 1000 * 10) / 10,
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
                },
                chartArea: {left:'10%', 'width': '80%', 'height': '80%'},
                // pieSliceText: "none",
            };

            chart.draw(dataTable, options);
        }

        function drawLineChart(chartID) {
            if (overallEmissionsLineChart !== undefined) {
                console.log("already loaded overallEmissionsLineChart")
                return;
            }
            var dataTable = new google.visualization.DataTable();
            dataTable.addColumn('string', 'Year' );
            dataTable.addColumn('number', 'Personal Transportation Emissions' );
            dataTable.addColumn('number', 'USA (pass. trans. per capita)' );
            dataTable.addColumn('number', 'USA 2015 Paris Climate Accords Goal' );
            dataTable.addColumn('number', 'Global (pass. trans. per capita)' );

            // global emissions from passenger transport (Passenger road vehicles, Aviation, Rail) https://www.iea.org/data-and-statistics/charts/transport-sector-co2-emissions-by-mode-in-the-sustainable-development-scenario-2000-2030
            // world population by year https://www.worldometers.info/world-population/world-population-by-year/
            var worldTotalPersonalTransporationPerCapita = { 
                2010: 0.567973156,
                2011: 0.565946704,
                2012: 0.568916286,
                2013: 0.579894213,
                2014: 0.584254256,
                2015: 0.600838366,
                2016: 0.610212495,
                2017: 0.611524867,
                2018: 0.607438158,
                2019: null,
                2020: 0.553599925, // "compared to 2019... a drop of 7% in global emissions." https://www.carbonbrief.org/global-carbon-project-coronavirus-causes-record-fall-in-fossil-fuel-emissions-in-2020
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
                console.log("annualSum",annualSum);
                annualEmisionsData.push([
                    year.toString(), 
                    annualSum, 
                    // getAnnualBudgetAllowance(reductionPercentageGoal, year, getAverageTotalAnnualEmissions()) / 1000, 
                    usaTotalPersonalTransportationPerCapita[year],
                    getAnnualBudgetAllowance(reductionPercentageGoal, year, getUSAATPTE2010To2015()),
                    worldTotalPersonalTransporationPerCapita[year],
                ]);
            }
            dataTable.addRows(annualEmisionsData);

            var chartElement = document.getElementById(chartID);
            var chart = new google.visualization.LineChart(chartElement);
            
            var options = {
                legend: {
                    position: 'none'
                },
                vAxis: {
                    title: 'Tonnes of CO2'
                },
                fontName: "Noto Sans",
                pointsVisible: true,
                interpolateNulls: true,
            };

            chart.draw(dataTable, options);
            return chart;
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
                drawLineChart('overall-emissions-line-chart');
                window.onresize = () => {
                    // TODO: Complete
                    drawCalendarChart(year, false, 'activity-daily-emissions-chart');
                    drawCalendarChart(year, true, 'activity-cumulative-emissions-chart');
                    drawDonutChart('total-emissions-donut-chart');
                    drawLineChart('overall-emissions-line-chart');
                };
            });
        }

        function generateYearSelection() {
            var yearStrings = Object.keys(activityEmissionsByYear);
            yearStrings.sort(function (a, b) {
                return ('' + a.attr).localeCompare(b.attr);
            });
            var earliestYear = parseInt(yearStrings[0]);
            var latestYear = (new Date()).getFullYear();
            for (var year = earliestYear; year <= latestYear; year++) {
                var yearSelector = document.createElement("div");
                yearSelector.className = "year-control-panel-selector button";
                yearSelector.id = "year-control-panel-selector-" + year;
                yearSelector.innerText = year;
                if (activityEmissionsByYear[year.toString()] === undefined) {
                    yearSelector.classList.add("inactive");
                } else {
                    yearSelector.onclick = (e) => {
                        var year = parseInt(e.target.getAttribute("year"));
                        chooseYear(year);
                        gtag('event', 'on_choose_year', {
                            scope: selectedScope,
                            year: year,
                            activity: selectedActivity,
                            overallChart: selectedOverallChart,
                            annualChart: selectedAnnualChart,
                        });
                    };
                }

                if (year.toString() === selectedYear.toString()) {
                    yearSelector.classList.add("selected");
                }
                yearSelector.setAttribute("year", year.toString());
                yearSelectorContainer.appendChild(yearSelector);
            }
        }

        function filterActivitySelection() {
            activitySelectorContainer.style.display = "flex";
            var currentlySelectedActivityInYear = false;
            var firstUnfilteredActivity = undefined;
            var activitySelectors = activitySelectorContainer.children;
            for (var i = 0; i < activitySelectors.length; i++) {
                var activitySelector = activitySelectors[i];
                activitySelector.classList.remove("selected");
                var activitySelectorActivity = activitySelector.getAttribute("activity");
                if (activityEmissionsByYear[selectedYear][activitySelectorActivity] === undefined) {
                    activitySelector.style.display = "none";
                } else {
                    if (selectedActivity === activitySelectorActivity) {
                        currentlySelectedActivityInYear = true;
                        activitySelector.classList.add("selected");
                    }
                    activitySelector.style.display = "flex";
                }
                if (firstUnfilteredActivity === undefined) {
                    firstUnfilteredActivity = activitySelector;
                }
            }

            if (!currentlySelectedActivityInYear) {
                firstUnfilteredActivity.classList.add("selected");
                selectedActivity = firstUnfilteredActivity.getAttribute("activity");
            }
        }

        function chooseScope(scope) {
            selectedScope = scope;
            for (var i = 0; i < scopeButtons.length; i++) {
                var scopeButton = scopeButtons[i];
                var buttonScope = scopeButton.getAttribute("scope");
                scopeButton.classList.remove("selected");
                if (selectedScope === buttonScope) {
                    scopeButton.classList.add("selected");
                }
            }
            switch (scope) {
                case "overall":
                    // show overall chart type selection
                    for (var i = 0; i < chartButtons.length; i++) {
                        var chartButton = chartButtons[i];
                        var chartName = chartButton.getAttribute("chartname");
                        switch(chartName) {
                            case "donate":
                                chartButton.style.display = "flex";
                                break;
                            case "donut":
                                chartButton.style.display = "flex";
                                break;
                            case "line":
                                chartButton.style.display = "flex";
                                break;
                            case "map":
                                chartButton.style.display = "none";
                                break;
                            case "calendar":
                                chartButton.style.display = "none";
                                break;
                        }
                    }
                    // show chosen overall chart and modify selection in control panel
                    chooseChart(selectedOverallChart);
                    break;
                case "annual":
                    // show annual chart type selection
                    for (var i = 0; i < chartButtons.length; i++) {
                        var chartButton = chartButtons[i];
                        var chartName = chartButton.getAttribute("chartname");
                        switch(chartName) {
                            case "donate":
                                chartButton.style.display = "flex";
                                break;
                            case "donut":
                                chartButton.style.display = "none";
                                break;
                            case "line":
                                chartButton.style.display = "none";
                                break;
                            case "map":
                                chartButton.style.display = "flex";
                                break;
                            case "calendar":
                                chartButton.style.display = "flex";
                                break;
                        }
                    }
                    // show chosen annual chart and modify selection in control panel
                    chooseChart(selectedAnnualChart);
                    break;
                default:
                    console.warn("unknown chosen scope", event);
                    break;
            }
        }

        function chooseChart(chartName) {
            switch (selectedScope) {
                case "overall":
                    selectedOverallChart = chartName;
                    for (var i = 0; i < chartButtons.length; i++) {
                        var chartButton = chartButtons[i];
                        var buttonChartName = chartButton.getAttribute("chartname");
                        chartButton.classList.remove("selected");
                        if (selectedOverallChart === buttonChartName) {
                            chartButton.classList.add("selected");
                        }
                    }
                    switch(chartName) {
                        case "donate":
                            for (var i = 0; i < presentationSections.length; i++) {
                                presentationSections[i].style.display = "block";
                            }
                            emissionsBreakdown.style.display = "block";
                            donationCallToAction.style.display = "block";
                            overallLineChartLegendContainer.style.display = "none";
                            overallEmissionsLineChartContainer.style.display = "none";
                            overallDonutChartLegendContainer.style.display = "none";
                            overallEmissionsDonutChartContainer.style.display = "none";
                            annualEmissionsByActivityMapContainer.style.display = "none";
                            annualEmissionsCalendarChartLegendsContainer.style.display = "none";
                            annualEmissionsCalendarChartsContainer.style.display = "none";
                            yearSelectorContainer.style.display = "none";
                            activitySelectorContainer.style.display = "none";
                            break;
                        case "donut":
                            for (var i = 0; i < presentationSections.length; i++) {
                                presentationSections[i].style.display = "block";
                            }
                            emissionsBreakdown.style.display = "none";
                            donationCallToAction.style.display = "none";
                            overallLineChartLegendContainer.style.display = "none";
                            overallEmissionsLineChartContainer.style.display = "none";
                            overallEmissionsDonutChartContainer.style.display = "flex";
                            donutEmissionsChart = drawDonutChart("overall-emissions-donut-chart");
                            overallDonutChartLegendContainer.style.display = "block";
                            annualEmissionsByActivityMapContainer.style.display = "none";
                            annualEmissionsCalendarChartLegendsContainer.style.display = "none";
                            annualEmissionsCalendarChartsContainer.style.display = "none";
                            yearSelectorContainer.style.display = "none";
                            activitySelectorContainer.style.display = "none";
                            break;
                        case "line":
                            for (var i = 0; i < presentationSections.length; i++) {
                                presentationSections[i].style.display = "block";
                            }
                            emissionsBreakdown.style.display = "none";
                            donationCallToAction.style.display = "none";
                            overallLineChartLegendContainer.style.display = "block";
                            overallEmissionsLineChartContainer.style.display = "flex";
                            overallEmissionsLineChart = drawLineChart("overall-emissions-line-chart");
                            overallDonutChartLegendContainer.style.display = "none";
                            overallEmissionsDonutChartContainer.style.display = "none";
                            annualEmissionsByActivityMapContainer.style.display = "none";
                            annualEmissionsCalendarChartLegendsContainer.style.display = "none";
                            annualEmissionsCalendarChartsContainer.style.display = "none";
                            yearSelectorContainer.style.display = "none";
                            activitySelectorContainer.style.display = "none";
                            break;
                        case "map":
                            console.warn(chartName, "chart choice is not valid for overall");
                            break;
                        case "calendar":
                            console.warn(chartName, "chart choice is not valid for overall");
                            break;
                        default:
                            console.warn("unknown chosen chart");
                            break;
                    }
                    break;
                case "annual":
                    selectedAnnualChart = chartName;
                    for (var i = 0; i < chartButtons.length; i++) {
                        var chartButton = chartButtons[i];
                        var buttonChartName = chartButton.getAttribute("chartname");
                        chartButton.classList.remove("selected");
                        if (selectedAnnualChart === buttonChartName) {
                            chartButton.classList.add("selected");
                        }
                    }
                    switch(chartName) {
                        case "donate":
                            for (var i = 0; i < presentationSections.length; i++) {
                                presentationSections[i].style.display = "block";
                            }
                            emissionsBreakdown.style.display = "block";
                            donationCallToAction.style.display = "block";
                            overallLineChartLegendContainer.style.display = "none";
                            overallEmissionsLineChartContainer.style.display = "none";
                            overallDonutChartLegendContainer.style.display = "none";
                            overallEmissionsDonutChartContainer.style.display = "none";
                            annualEmissionsByActivityMapContainer.style.display = "none";
                            annualEmissionsCalendarChartLegendsContainer.style.display = "none";
                            annualEmissionsCalendarChartsContainer.style.display = "none";
                            yearSelectorContainer.style.display = "none";
                            activitySelectorContainer.style.display = "none";
                            break;
                        case "donut":
                            console.warn(chartName, "chart choice is not valid for annual");
                            break;
                        case "line":
                            console.warn(chartName, "chart choice is not valid for annual");
                            break;
                        case "map":
                            for (var i = 0; i < presentationSections.length; i++) {
                                presentationSections[i].style.display = "none";
                            }
                            emissionsBreakdown.style.display = "none";
                            donationCallToAction.style.display = "none";
                            overallLineChartLegendContainer.style.display = "none";
                            overallEmissionsLineChartContainer.style.display = "none";
                            overallDonutChartLegendContainer.style.display = "none";
                            overallEmissionsDonutChartContainer.style.display = "none";
                            annualEmissionsByActivityMapContainer.style.display = "block";
                            filterActivitySelection();
                            annualEmissionsByActivityMap = drawMap(selectedYear, selectedActivity, mapID);
                            annualEmissionsCalendarChartLegendsContainer.style.display = "none";
                            annualEmissionsCalendarChartsContainer.style.display = "none";
                            yearSelectorContainer.style.display = "flex";
                            break;
                        case "calendar":
                            for (var i = 0; i < presentationSections.length; i++) {
                                presentationSections[i].style.display = "block";
                            }
                            emissionsBreakdown.style.display = "none";
                            donationCallToAction.style.display = "none";
                            overallLineChartLegendContainer.style.display = "none";
                            overallEmissionsLineChartContainer.style.display = "none";
                            overallDonutChartLegendContainer.style.display = "none";
                            overallEmissionsDonutChartContainer.style.display = "none";
                            annualEmissionsByActivityMapContainer.style.display = "none";
                            annualEmissionsCalendarChartLegendsContainer.style.display = "block";
                            annualEmissionsCalendarChartsContainer.style.display = "block";
                            annualEmissionsCalendarDailyChart = drawCalendarChart(selectedYear, false, 'annual-emissions-calendar-chart-daily');
                            annualEmissionsCalendarCumulativeChart = drawCalendarChart(selectedYear, true, 'annual-emissions-calendar-chart-cumulative');
                            yearSelectorContainer.style.display = "flex";
                            activitySelectorContainer.style.display = "none";
                            break;
                        default:
                            console.warn("unknown chosen chart");
                            break;
                    }
                    break;
            }
            gtag('event', 'on_choose_chart', {
                scope: selectedScope,
                year: selectedYear,
                activity: selectedActivity,
                overallChart: selectedOverallChart,
                annualChart: selectedAnnualChart,
            });
        }

        function changeYearText(year) {
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
            for (var i = 0; i < selectedYearElements.length; i++) {
                selectedYearElements[i].innerText = year;
            }
            for (var i = 0; i < yearMaxDayElements.length; i++) {
                var yearMaxDate = getYearMaxDayAndEmissions(year).maxDate;
                yearMaxDayElements[i].innerText = titleCase(monthNames[yearMaxDate.getMonth()]) + " " + yearMaxDate.getDate();;
            }
            for (var i = 0; i < yearMaxEmissionsElements.length; i++) {
                var yearMaxEmissions = Math.round(getYearMaxDayAndEmissions(year).maxEmissions * 10) / 10;
                yearMaxEmissionsElements[i].innerText = yearMaxEmissions
            }
        }

        function chooseYear(yearNum) {
            selectedYear = yearNum;
            var yearSelectors = yearSelectorContainer.children;
            for (var i = 0; i < yearSelectors.length; i++) {
                yearSelectors[i].classList.remove("selected");
                if (yearSelectors[i].getAttribute("year") === selectedYear.toString()) {
                    yearSelectors[i].classList.add("selected");
                }
            }
            chooseChart(selectedAnnualChart);
            changeYearText(yearNum);
            // changeAllText(selectedYear);
            // drawAllCharts(selectedYear);
            // drawMap(selectedYear, selectedActivity);
        }

        function chooseActivity(event) {
            selectedActivity = event.target.getAttribute("activity");
            gtag('event', 'on_choose_activity', {
                scope: selectedScope,
                year: selectedYear,
                activity: selectedActivity,
                overallChart: selectedOverallChart,
                annualChart: selectedAnnualChart,
            });
            var activitySelectors = activitySelectorContainer.children;
            for (var i = 0; i < activitySelectors.length; i++) {
                activitySelectors[i].classList.remove("selected");
                if (activitySelectors[i].getAttribute("activity") === selectedActivity) {
                    activitySelectors[i].classList.add("selected");
                }
            }
            drawMap(selectedYear, selectedActivity, mapID);
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
            var annualBudgetAllowance = getAnnualBudgetAllowance(reductionPercentageGoal, year, getUSAATPTE2010To2015());
            annualExcess[year] = getAnnualTotal(year) / 1000 - annualBudgetAllowance;
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
            var annualAllowance = getAnnualBudgetAllowance(reductionPercentageGoal, year, getUSAATPTE2010To2015());
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

        function getYearMaxDayAndEmissions(year) {
            console.log(year, activityEmissionsByDay)
            var yearEmissions = activityEmissionsByDay[year];
            if (yearEmissions === undefined) {
                console.error("getYearMaxDayAndEmissions TODO", year);
                return undefined;
            } else {
                if (yearMaxDayAndEmissions[year] === undefined) {
                    var yearMaxDayEmissions = 0;
                    var yearMaxDate = undefined;
                    
                    var latestDate = new Date(year+1, 0, 1);
                    for (var current = new Date(year, 0, 1); current < latestDate; current.setDate(current.getDate() + 1)) {
                        var monthName = monthNames[current.getMonth()];
                        var monthActivityEmissionsByDay = yearEmissions[monthName];
                        if (monthActivityEmissionsByDay === undefined) {
                            console.warn("this month not in year yearEmissions[monthName]", year, current.getMonth(), monthName);
                            continue;
                        }
                        var activityEmissionsByMonthDay = monthActivityEmissionsByDay[current.getDate()];
                        if (activityEmissionsByMonthDay !== undefined) {
                            var dayEmissionSum = 0;
                            Object.entries(activityEmissionsByMonthDay).forEach(function (activityEmissionsEntry) {
                                var activityEmissions = activityEmissionsEntry[1];
                                dayEmissionSum += activityEmissions;
                            });
                            if (dayEmissionSum > yearMaxDayEmissions) {
                                yearMaxDayEmissions = dayEmissionSum;
                                yearMaxDate = new Date(current);
                            }
                        }
                    }
                    yearMaxDayAndEmissions[year] = {
                        maxEmissions: yearMaxDayEmissions,
                        maxDate: yearMaxDate,
                    };
                }
                return yearMaxDayAndEmissions[year];
            }
        }

        function getEarliestYear() {
            var yearStrings = Object.keys(fileProcessProgress);
            yearStrings.sort(function (a, b) {
                return ('' + a.attr).localeCompare(b.attr);
            });
            return parseInt(yearStrings[0]);
        }

        function getFormattedActivityType(activityType) {
            return titleCase(activityType.replaceAll("_"," ").replace("IN ", ""));
        }

        function changeOverallText() {
            tfYearCount.innerText = getYearCount();
            tfHalfTotalEmissions.innerText = numberWithCommas(Math.round(getTotalEmissions() / 2 * 10) / 10);
            for (var i = 0; i < totalEmissionsElements.length; i++) {
                totalEmissionsElements[i].innerText = numberWithCommas(Math.round(getTotalEmissions() * 10) / 10);
            }
            for (var i = 0; i < quarterTotalEmissionsElements.length; i++) {
                quarterTotalEmissionsElements[i].innerText = numberWithCommas(Math.round(getTotalEmissions() / 4 * 10) / 10);
            }
            for (var i = 0; i < earliestYearElements.length; i++) {
                earliestYearElements[i].innerText = getEarliestYear();
            }
            for (var i = 0; i < donationCalculationElements.length; i++) {
                donationCalculationElements[i].innerText = numberWithCommas(Math.round(getTotalEmissions() * 10 /* USD */ * 100) / 100);
            }
        }

        function drawMap(year, activityType, mapID) {
            tfAnnualEmissionsByActivityMapLabel.innerText = year + ": " + 
            numberWithCommas(Math.round(activityDistancesByYear[year][selectedActivity] / 1000 * 10) / 10) + 
            " " + getFormattedActivityType(selectedActivity) + " km";
            console.log("drawMap", year, activityType, mapID);
            if (annualEmissionsByActivityMap === undefined) {
                annualEmissionsByActivityMap = L.map(mapID).setView([0, 0], 2);
                var tiles = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
                    minZoom: 2
                }).addTo(annualEmissionsByActivityMap);
            } else {
                // TODO: Also check if the year and selectedType are different from how they were, otherwise no need to refresh
                annualEmissionsByActivityMap.eachLayer(function(layer){
                    if (layer._url === undefined) {
                        annualEmissionsByActivityMap.removeLayer(layer);
                    }
                });
            }
            switch (activityType) {
                case "FLYING": 
                case "IN_TRAIN":
                    var polygroup = mapDataByYear[year][activityType];
                    if (polygroup !== undefined) {
                        polygroup.addTo(annualEmissionsByActivityMap);
                    }
                    break;
                case "IN_BUS":
                case "IN_FERRY":
                case "IN_PASSENGER_VEHICLE":
                case "IN_SUBWAY":
                case "MOTORCYCLING":
                    var heatLayer = mapDataByYear[year][activityType];
                    if (heatLayer !== undefined) {
                        heatLayer.addTo(annualEmissionsByActivityMap);
                    }
                    break;
            }
            return annualEmissionsByActivityMap;
        }

        function getAnnualBudgetAllowance(reductionPercentageGoal, currentYear, annualEmissionsAverage) {
            return annualEmissionsAverage * Math.pow((1 - reductionPercentageGoal),(currentYear - 2015 + 1));
        }

        showPresentationStage();        
    }

})(this);