class DataModel {
    constructor() {
        this.activityEmissionsByDay = {};
        this.activityEmissionsByMonth = {};
        this.activityEmissionsByYear = {};
        this.activityEmissionsTotals = {};
        this.fileProcessProgress = {};
        this.flights = {};
        this.history = {};
    }

    get averageTotalAnnualEmissions() {
        var years = Object.keys(this.activityEmissionsByMonth);
		if (years.length > 0) {
			var startAveragingFromYear = 3000;
			for (let i = 0 ; i < years.length; i++) {
				startAveragingFromYear = parseInt(years[i]) < startAveragingFromYear ? parseInt(years[i]) : startAveragingFromYear;
			}
			if (startAveragingFromYear < 2015) {
				startAveragingFromYear = 2015;
			} 
			
			var startAveragingFromMonth = 0; // JANUARY
			var firstYearsMonths = Object.keys(this.activityEmissionsByMonth[startAveragingFromYear]);
			if (firstYearsMonths.length > 1) { // assume that the first month is incomplete
				if (firstYearsMonths.length < 12) {
					startAveragingFromMonth = 12 - firstYearsMonths.length + 1; // again, assume that the first month is incomplete
				}
				var monthCount = 0;
				var totalEmissions = 0;
				// average over every month starting from this one
				for (let year = startAveragingFromYear; 
					year <= (new Date()).getUTCFullYear() && this.activityEmissionsByMonth[year] !== undefined; 
					year++) {
					monthCount += Object.keys(this.activityEmissionsByMonth[year]).length;
					var yearlyActivities = Object.keys(this.activityEmissionsByYear[year]);
					for (let activityIndex = 0; activityIndex < yearlyActivities.length; activityIndex++) {
						var activityName = yearlyActivities[activityIndex];
						totalEmissions += this.activityEmissionsByYear[year][activityName];
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

    get annualBudgetAllowance() {
		return this.calcAnnualBudgetAllowance();
    }

    calcAnnualBudgetAllowance(reductionPercentageGoal, currentYear, averageAnnualEmissions) {
        return averageAnnualEmissions * Math.pow((1 - reductionPercentageGoal),(currentYear - 2015 + 1));
    }

    get allFilesProcessed() {
        var allProcessed = true;
		Object.entries(this.fileProcessProgress).forEach(function(progressEntry, index) {
			allProcessed = allProcessed && progressEntry[1].processText;
		})
		return allProcessed;
    }
    
    // UK Department for Business, Energy, and Industrial Strategy - 2019 Government greenhouse gas conversion factors for company reporting
	// https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/904215/2019-ghg-conversion-factors-methodology-v01-02.pdf
	getActivityEmissions(distance, activity) {
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

    processSegment (segment, index, year, month) {
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

            var activityEmissions = this.getActivityEmissions(distance, activityType);
            if (activityEmissions > 0) {
                if (this.activityEmissionsTotals[activityType] === undefined) {
                    this.activityEmissionsTotals[activityType] = activityEmissions;
                } else {
                    this.activityEmissionsTotals[activityType] += activityEmissions;
                }

                if (this.activityEmissionsByYear[year][activityType] === undefined) {
                    this.activityEmissionsByYear[year][activityType] = activityEmissions;
                } else {
                    this.activityEmissionsByYear[year][activityType] += activityEmissions;
                }

                if (this.activityEmissionsByMonth[year][month][activityType]) {
                    this.activityEmissionsByMonth[year][month][activityType] += activityEmissions;
                } else {
                    this.activityEmissionsByMonth[year][month][activityType] =  activityEmissions;
                }

                if (segment.activitySegment.duration && 
                    segment.activitySegment.duration.startTimestampMs) {
                    var date = (new Date(parseInt(segment.activitySegment.duration.startTimestampMs))).getDate()
                    if (this.activityEmissionsByDay[year][month][date] === undefined) {
                        this.activityEmissionsByDay[year][month][date] = {};
                    } 
                    if (this.activityEmissionsByDay[year][month][date][activityType] === undefined) {
                        this.activityEmissionsByDay[year][month][date][activityType] = activityEmissions;
                    } else {
                        this.activityEmissionsByDay[year][month][date][activityType] += activityEmissions;
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
                        this.flights[year][month].push(latlngs);
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

    onAllFilesProcessed() {
        console.log("All files processed.", 
            this.fileProcessProgress, 
            this.activityEmissionsByDay,
            this.activityEmissionsByMonth, 
            this.activityEmissionsByYear,
            this.activityEmissionsTotals, 
            this.averageTotalAnnualEmissions,
            this.flights);
    }
    
    handleExtractedFile(entry, fileIndex, onFileNameParsed, onFileReadProgress, onFileProcessingDone) {			
        var pathComponents = entry.filename.split("/");
        var year = pathComponents[pathComponents.length - 2]; // string
        var month = pathComponents[pathComponents.length - 1].split("_")[1].split(".")[0]; // after the '20XX_' and before the '.json'
        onFileNameParsed(year, month);

        if (this.activityEmissionsByYear[year] === undefined) {
            this.activityEmissionsByYear[year] = {};
        }

        if (this.activityEmissionsByMonth[year] === undefined) {
            this.activityEmissionsByMonth[year] = {};
        }
        if (this.activityEmissionsByMonth[year][month] === undefined) {
            this.activityEmissionsByMonth[year][month] = {};
        }

        if (this.activityEmissionsByDay[year] === undefined) {
            this.activityEmissionsByDay[year] = {};
        }
        if (this.activityEmissionsByDay[year][month] === undefined) {
            this.activityEmissionsByDay[year][month] = {};
        }

        if (this.flights[year] === undefined) {
            this.flights[year] = {};
        }
        if (this.flights[year][month] === undefined) {
            this.flights[year][month] = [];
        }
        var self = this;

        entry.getData(new zip.TextWriter(), function(fileText) {
            var parsedSemanticHistory = JSON.parse(fileText);
            self.history[entry.filename] = parsedSemanticHistory; // TODO: Potentially remove.
            if (parsedSemanticHistory?.timelineObjects) {
                parsedSemanticHistory.timelineObjects.forEach(function(segment, index) { 
                    self.processSegment(segment, index, year, month);
                });
                self.fileProcessProgress[entry.filename] = {
                    readText: fileProcessProgress[entry.filename].readText,
                    processText: true,
                };
                if (self.allFilesProcessed) {
                    // TODO: 
                }
            } else {

            }
        }, function(current, total) {
            // onprogress callback
            var progressPercentage = current/total;
            self.fileProcessProgress[entry.filename] = {
                readText: progressPercentage,
                processText: false,
            };
            onFileReadProgress(current, total, year, month);
            if (progressPercentage == 1) {
                onFileProcessingDone()
            } 
        });
    }
}

class ViewController {

    constructor(dataModel) {
        this.dataModel = dataModel;
        this.fileInput = document.getElementById("file-input");
        this.fileProgressMeter = document.getElementById("file-progress-meter");
        this.fileProgressMeterList = document.getElementById("file-progress-meter-list");
    }

    makeDOMInteractive() {
        this.fileInput.onchange = this.onUploadFile.bind(this);
    }

    getEntries(file, onend) {
        zip.createReader(new zip.BlobReader(file), function(zipReader) {
            zipReader.getEntries(onend);
        }, onerror);
    }

    onUploadFile(event) {
        console.log(event);
        this.fileInput.disabled = true;
        var self = this;
        console.log(self);
        this.getEntries(this.fileInput.files[0], function(entries) {
            var filteredEntries = entries.filter(function(entry) {
                // e.g. Semantic Location History/2013/2013_SEPTEMBER.json
                var semanticLocationHistoryFilePattern = /Semantic Location History\/([0-9]{4})\/([0-9]{4})_(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER).json/g;
                return (entry.filename.match(semanticLocationHistoryFilePattern) !== null);
            });
            // populate the progress map
            filteredEntries.forEach(function(entry) {
                if (self.dataModel.fileProcessProgress[entry.filename] === undefined) {
                    self.dataModel.fileProcessProgress[entry.filename] = {
                        readText: 0,
                        processText: false,
                    };
                }
            });
            filteredEntries.forEach(function(entry, index) {
                self.dataModel.handleExtractedFile(entry, index, self.createFileProgressElement, self.onFileProgressReported, self.onFileDone)
            });
        });
    }

    createFileProgressElement(year, month) {
        var progressMeter = document.createElement("span");
        progressMeter.id = "progress-meter-" + year + "-" + month;
        this.fileProgressMeterList.appendChild(progressMeter);
    }

    onFileProgressReported(current, total, year, month) {
        // onprogress callback
        var progressPercentage = current/total;
        var progressMeter = document.getElementById("progress-meter-" + year + "-" + month);
        progressMeter.textContent = progressPercentage + " ";
        this.fileProgressMeter.textContent = this.dataModel.getTotalReadFileProgress();
    }

    onFileDone() {
        
    }
}

var dataModel = new DataModel();
var viewController = new ViewController(dataModel);
viewController.makeDOMInteractive();