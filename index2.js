(function(obj) {
	var requestFileSystem = obj.webkitRequestFileSystem || obj.mozRequestFileSystem || obj.requestFileSystem;
	var activityEmissionsByDay = {};
	var activityEmissionsByMonth = {};
	var activityEmissionsByYear = {};
	var activityEmissionsTotals = {};
    var fileProcessProgress = {};

    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const monthNums = {"JANUARY": 0, "FEBRUARY": 1, "MARCH": 2, "APRIL": 3, "MAY": 4, "JUNE": 5, "JULY": 6, "AUGUST": 7, "SEPTEMBER": 8, "OCTOBER": 9, "NOVEMBER": 10, "DECEMBER": 11};

    var mapDataByYear = {};

    var dailyEmissionsChart = {};

    uploadStage();

    function uploadStage() {
        // interactive document elements
        var fileInput = document.getElementById("file-input");
        var fileProgressMeter = document.getElementById("upload-progress-bar"); 
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

        var uploadViewSections = document.getElementsByClassName("upload-view-section");
        var uploadBackButton = document.getElementById("main-view-button-upload-back");
        var uploadProgressContainer = document.getElementById("upload-progress-container");
        var uploadProgressIndicatorComponents = {};
        var uploadErrorContainer = document.getElementById("upload-error-container");
        var uploadErrorsList = document.getElementById("upload-errors-list");
        
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

                if (uploadProgressIndicatorComponents[yearString][monthName] !== undefined) {
                    uploadProgressIndicatorComponents[yearString][monthName].style.backgroundColor = "rgb(210, 110, 110)";
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
                                    mapDataByYear[yearString][activityType] = L.heatLayer([]);
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
                showErrors();
            } else {
                hideUploadStage();
                presentationStage();
            }
            // gtag('event', 'on_all_files_processed');
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
            uploadProgressIndicatorComponents[yearString][monthName].style.backgroundColor = progressIndicatorColorRGB;
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

        function generateUploadProgress(filteredEntries) {
            var importWarningElement = document.createElement("div");
            importWarningElement.innerHTML = "Do not change tabs or press back. Even if the page seems to freeze, the import should only take a maximum of 2 minutes.";
            uploadProgressContainer.prepend(importWarningElement);

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
            })
            var yearStrings = Object.keys(fileProcessProgress);
            yearStrings.sort(function (a, b) {
                return ('' + a.attr).localeCompare(b.attr);
            });
            var earliestYear = parseInt(yearStrings[0]);
            var latestYear = (new Date()).getFullYear();

            for (var year = earliestYear; year <= latestYear; year++) {
                var yearString = year + "";
                var uploadProgressYearContainer = document.createElement("div");
                uploadProgressYearContainer.className = "upload-progress-year-container";
                uploadProgressYearContainer.id = "upload-progress-year-container-" + yearString;
                for (var j = 0; j < 12; j++) {
                    var uploadProgressMonthContainer = document.createElement("div");
                    uploadProgressMonthContainer.className = "upload-progress-month-container";
                    uploadProgressMonthContainer.id = "upload-progress-month-container-" + yearString + "-" + j;
                    
                    var uploadProgressMonthIndicator = document.createElement("div");
                    uploadProgressMonthIndicator.classList.add("upload-progress-month-indicator");
                    uploadProgressMonthIndicator.classList.add("month-missing");
                    uploadProgressMonthIndicator.id = "upload-progress-month-indicator-" + yearString + "-" + j;

                    var monthName = monthNames[j];
                    if (fileProcessProgress[yearString] !== undefined && 
                        fileProcessProgress[yearString][monthName] !== undefined) {
                        uploadProgressMonthIndicator.classList.remove("month-missing");
                    }
                    
                    uploadProgressMonthContainer.appendChild(uploadProgressMonthIndicator);

                    if (j < 11) {
                        var uploadProgressMonthSpacer = document.createElement("div");
                        uploadProgressMonthSpacer.className = "upload-progress-month-spacer";
                        uploadProgressMonthSpacer.id = "upload-progress-month-spacer-" + yearString + "-" + j;
                        uploadProgressMonthContainer.appendChild(uploadProgressMonthSpacer);
                    }
                    
                    uploadProgressYearContainer.appendChild(uploadProgressMonthContainer);
                    if (uploadProgressIndicatorComponents[yearString] === undefined) {
                        uploadProgressIndicatorComponents[yearString] = {};
                    }
                    uploadProgressIndicatorComponents[yearString][monthName] = uploadProgressMonthIndicator;
                }
                uploadProgressContainer.appendChild(uploadProgressYearContainer);
            }
        }

        function showErrors() {
            console.log(importErrors);
            // remove any pre-existing error components
            while (uploadErrorsList.firstChild) {
                uploadErrorsList.removeChild(uploadErrorsList.firstChild);
            }
            // generate error components
            Object.entries(importErrors).forEach(function(importErrorYearEntry) {
                Object.entries(importErrorYearEntry[1]).forEach(function(importErrorMonthEntry) {
                    var errorList = importErrorMonthEntry[1];
                    errorList.forEach(function(errorListItem) {
                        var errorElement = document.createElement("li");
                        errorElement.className = "upload-error-element";
                        errorElement.id = "upload-error-element-" + importErrorYearEntry[0] + "-" + importErrorMonthEntry[0];
                        var errorElementMessage = document.createElement("div");
                        errorElementMessage.className = "upload-error-element-text";
                        errorElementMessage.id = "upload-error-element-text-"  + importErrorYearEntry[0] + "-" + importErrorMonthEntry[0];
                        errorElementMessage.innerText = errorListItem.semanticError;
                        errorElement.appendChild(errorElementMessage);
                        uploadErrorsList.appendChild(errorElement);
                    });
                });
            })
            uploadErrorContainer.style.display = "block";
        }

        function showIntroductionStage() {
            introductionSection.style.display = "block";
        }

        function hideIntroductionStage() {
            introductionSection.style.display = "none";
        }

        function showQuestionStage() {
            for (var i = 0; i < aboutViewSections.length; i++) {
                aboutViewSections[i].style.display = "block";
            }
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
        }

        function hideQuestionStage() {
            for (var i = 0; i < aboutViewSections.length; i++) {
                aboutViewSections[i].style.display = "none";
            }
        }

        function showUploadStage() {
            for (var i = 0; i < aboutViewSections.length; i++) {
                uploadViewSections[i].style.display = "block";
            }
        }

        function hideUploadStage() {
            for (var i = 0; i < aboutViewSections.length; i++) {
                uploadViewSections[i].style.display = "none";
            }
        }

        function onEntriesExtracted(entries) {
            // filter the files that aren't history related
            var filteredEntries = entries.filter(function(entry) {
                // e.g. Semantic Location History/2013/2013_SEPTEMBER.json
                var semanticLocationHistoryFilePattern = /Semantic Location History\/([0-9]{4})\/([0-9]{4})_(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER).json/g;
                return (entry.filename.match(semanticLocationHistoryFilePattern) !== null);
            });
            generateUploadProgress(filteredEntries);
            filteredEntries.forEach(handleExtractedFile);
        }

        function onUploadFile(event) {
            fileInput.disabled = true;
            // gtag('event', 'on_zip_file_uploaded');
            getEntries(fileInput.files[0], onEntriesExtracted, onerror);
        }

        function makeDOMInteractive() {
            fileInput.addEventListener('change', onUploadFile, false);
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
                showUploadStage();
            }
            introButtonStart2.onclick = () => {
                hideQuestionStage();
                showUploadStage();
            }
            aboutBackButton.onclick = () => {
                hideQuestionStage();
                showIntroductionStage();
            }
            uploadBackButton.onclick = () => {
                hideUploadStage();
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

        var annualEmissionsChartLegend = document.getElementById("annual-emissions-chart-legend");
        var calendarEmissionsChartLegend = document.getElementById("calendar-emissions-charts-legend");
        var donationCallToAction = document.getElementById("donation-call-to-action");

        var emissionsBreakdown = document.getElementById("emissions-breakdown");
        var annualEmissionsChartContainer = document.getElementById("annual-emissions-chart-container");
        var annualEmissionsChart = undefined;

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
            for (var i = 0; i < presentationSections.length; i++) {
                presentationSections[i].style.display = "block";
            }
            for (var i = 0; i < activitySelectors.length; i++) {
                activitySelectors[i].onclick = chooseActivity;
            }
            for (var i = 0; i < scopeButtons.length; i++) {
                scopeButtons[i].onclick = chooseScope;
            }
            for (var i = 0; i < chartButtons.length; i++) {
                chartButtons[i].onclick = (event) => {chooseChart(event.target.getAttribute("chartname"));};
            }
            scopeSelectorContainer.style.display = "grid";
            chevronElement.style.display = "flex";
            chartSelectorContainer.style.display = "grid";
            yearSelectorContainer.style.display = "inline-flex";
            // activitySelectorContainer.style.display = (selectedAnnualChart === "map") ? "block" : "none";

            generateYearSelection();
            chooseYear(selectedYear);
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
            if (annualEmissionsChart !== undefined) {
                console.log("already loaded annualEmissionsChart")
                return;
            }
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
                    getAnnualBudgetAllowance(reductionPercentageGoal, year, getAverageTotalAnnualEmissions()) / 1000, 
                    usaTotalPerCapita[year] * transportationShareOfUSACarbon,
                    worldTotalPerCapita[year] * transportationShareOfGlobalCarbon,
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
                    yearSelector.onclick = chooseYear;
                }

                if (year.toString() === selectedYear.toString()) {
                    yearSelector.classList.add("selected");
                }
                yearSelector.setAttribute("year", year.toString());
                yearSelectorContainer.appendChild(yearSelector);
            }
        }

        function filterActivitySelection() {
            activitySelectorContainer.style.display = "block";
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

        function chooseScope(event) {
            var scope = event.target.getAttribute("scope");
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
                    // hide year selector
                    yearSelectorContainer.style.display = "none";
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
                    // show year selector
                    yearSelectorContainer.style.display = "block";
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
                            emissionsBreakdown.style.display = "block";
                            donationCallToAction.style.display = "block";
                            annualEmissionsChartLegend.style.display = "none";
                            annualEmissionsChartContainer.style.display = "none";
                            activitySelectorContainer.style.display = "none";
                            break;
                        case "donut":
                            emissionsBreakdown.style.display = "none";
                            donationCallToAction.style.display = "none";
                            annualEmissionsChartLegend.style.display = "none";
                            annualEmissionsChartContainer.style.display = "none";
                            activitySelectorContainer.style.display = "none";
                            break;
                        case "line":
                            emissionsBreakdown.style.display = "none";
                            donationCallToAction.style.display = "none";
                            annualEmissionsChartLegend.style.display = "block";
                            annualEmissionsChartContainer.style.display = "flex";
                            annualEmissionsChart = drawLineChart("annual-emissions-chart");
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
                            emissionsBreakdown.style.display = "block";
                            donationCallToAction.style.display = "block";
                            annualEmissionsChartLegend.style.display = "none";
                            annualEmissionsChartContainer.style.display = "none";
                            activitySelectorContainer.style.display = "none";
                            break;
                        case "donut":
                            console.warn(chartName, "chart choice is not valid for annual");
                            break;
                        case "line":
                            console.warn(chartName, "chart choice is not valid for annual");
                            break;
                        case "map":
                            emissionsBreakdown.style.display = "none";
                            donationCallToAction.style.display = "none";
                            annualEmissionsChartLegend.style.display = "none";
                            annualEmissionsChartContainer.style.display = "none";
                            filterActivitySelection();
                            break;
                        case "calendar":
                            emissionsBreakdown.style.display = "none";
                            donationCallToAction.style.display = "none";
                            annualEmissionsChartLegend.style.display = "none";
                            annualEmissionsChartContainer.style.display = "none";
                            activitySelectorContainer.style.display = "none";
                            break;
                        default:
                            console.warn("unknown chosen chart");
                            break;
                    }
                    break;
            }
            // chartname="donate"
            // chartname="donut"
            // chartname="line"
            // chartname="map"
            // chartname="calendar"
        }

        function chooseYear(event) {
            // gtag('event', 'on_choose_year');
            selectedYear = event.target.getAttribute("year");
            var yearSelectors = yearSelectorContainer.children;
            for (var i = 0; i < yearSelectors.length; i++) {
                yearSelectors[i].classList.remove("selected");
                if (yearSelectors[i].getAttribute("year") === selectedYear) {
                    yearSelectors[i].classList.add("selected");
                }
            }
            chooseChart(selectedAnnualChart);
            // changeAllText(selectedYear);
            // drawAllCharts(selectedYear);
            // drawMap(selectedYear, selectedActivity);
        }

        function chooseActivity(event) {
            // gtag('event', 'on_choose_activity');
            selectedActivity = event.target.getAttribute("activity");
            var activitySelectors = activitySelectorContainer.children;
            for (var i = 0; i < activitySelectors.length; i++) {
                activitySelectors[i].classList.remove("selected");
                if (activitySelectors[i].getAttribute("activity") === selectedActivity) {
                    activitySelectors[i].classList.add("selected");
                }
            }
            // drawMap(selectedYear, selectedActivity);
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