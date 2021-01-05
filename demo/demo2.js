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
    
    // document elements
    var fileInput = document.getElementById("file-input");
    var fileList = document.getElementById("file-list");
    var fileProgressMeterList = document.getElementById("file-progress-meter-list");
    var fileProgressMeter = document.getElementById("file-progress-meter");
    var creationMethodInput = document.getElementById("creation-method-input");
	
	// goal: 50% current emissions from year 2015 to 2030
	var reductionPercentageGoal = 0.0452; // 1 - Math.pow(0.5, 1/(2030 - 2015));

	var flights = {}; // TODO: Rename to flightPathsByYear and populate during processSegment(); perhaps make another function with switch statements to compile annual points/paths for mapping later.
	var history = {};

	function onerror(message) {
		console.log(message);
		alert(message);
	}

	function getEntries(file, onend) {
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

	function getAnnualBudgetAllowance(reductionPercentageGoal, currentYear, averageAnnualEmissions) {
		return averageAnnualEmissions * Math.pow((1 - reductionPercentageGoal),(currentYear - 2015 + 1));
	}

	function createCalendarDOM() {
		const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
		var chartContainer = document.getElementById("chart-container");
		months.forEach(function(month) {
			var monthContainer = document.createElement("div");
			monthContainer.className = "month-container";
			monthContainer.id = "month-container-" + month.toLowerCase();
			monthContainer.innerText = month;
			chartContainer.appendChild(monthContainer);
		})
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
            getAverageTotalAnnualEmissions(),
            flights);
    }

    function getTotalReadFileProgress() {
		var totalProgress = 0;
		Object.entries(fileProcessProgress).forEach(function(progressEntry, index) {
			totalProgress += progressEntry[1].readText;
		})
		return totalProgress / Object.keys(fileProcessProgress).length;
	}

    function handleExtractedFile(entry, index) {			
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

        var progressMeter = document.createElement("span");
        progressMeter.id = "progress-meter-" + year + "-" + month;
        fileProgressMeterList.appendChild(progressMeter);

        entry.getData(new zip.TextWriter(), function(fileText) {
            var parsedSemanticHistory = JSON.parse(fileText);
            history[entry.filename] = parsedSemanticHistory; // TODO: Potentially remove.
            if (parsedSemanticHistory?.timelineObjects) {
                parsedSemanticHistory.timelineObjects.forEach(function(segment, index) { 
                    processSegment(segment, index, year, month);
                });
                fileProcessProgress[entry.filename] = {
                    readText: fileProcessProgress[entry.filename].readText,
                    processText: true,
                };
                if (areAllFilesProcessed()) {
                    onAllFilesProcessed();
                }
            } else {

            }
        }, function(current, total) {
            // onprogress callback
            var progressPercentage = current/total;
            var progressMeter = document.getElementById("progress-meter-" + year + "-" + month);
            progressMeter.textContent = progressPercentage + " ";
            fileProcessProgress[entry.filename] = {
                readText: progressPercentage,
                processText: false,
            };
            fileProgressMeter.textContent = getTotalReadFileProgress();
        });
    }

    function onUploadFile(event) {
        console.log(event);
        fileInput.disabled = true;
        getEntries(fileInput.files[0], function(entries) {
            fileList.innerHTML = "";
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
		

		map = L.map( 'mapid' ).setView( [0,0], 1 );
		L.tileLayer( 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: 'location-history-visualizer is open source and available <a href="https://github.com/theopolisme/location-history-visualizer">on GitHub</a>. Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors.',
			maxZoom: 18,
			minZoom: 1
		} ).addTo( map );

		

		if (typeof requestFileSystem == "undefined")
			creationMethodInput.options.length = 1;
		fileInput.addEventListener('change', onUploadFile, false);
	}
	createCalendarDOM();
	makeDOMInteractive();
})(this);
