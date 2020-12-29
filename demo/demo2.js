(function(obj) {

	var requestFileSystem = obj.webkitRequestFileSystem || obj.mozRequestFileSystem || obj.requestFileSystem;
	var activityTypeDistances = {};
	var fileProcessProgress = {};

	function onerror(message) {
		console.log(message);
		alert(message);
	}

	function createTempFile(callback) {
		var tmpFilename = "tmp.dat";
		requestFileSystem(TEMPORARY, 4 * 1024 * 1024 * 1024, function(filesystem) {
			function create() {
				filesystem.root.getFile(tmpFilename, {
					create : true
				}, function(zipFile) {
					callback(zipFile);
				});
			}

			filesystem.root.getFile(tmpFilename, null, function(entry) {
				entry.remove(create, create);
			}, create);
		});
	}

	var model = (function() {
		var URL = obj.webkitURL || obj.mozURL || obj.URL;

		return {
			getEntries : function(file, onend) {
				zip.createReader(new zip.BlobReader(file), function(zipReader) {
					zipReader.getEntries(onend);
				}, onerror);
			},
			getEntryFile : function(entry, creationMethod, onend, onprogress) {
				var writer, zipFileEntry;

				function getData() {
					entry.getData(writer, function(blob) {
						var blobURL = creationMethod == "Blob" ? URL.createObjectURL(blob) : zipFileEntry.toURL();
						onend(blobURL);
					}, onprogress);
				}

				if (creationMethod == "Blob") {
					writer = new zip.BlobWriter();
					getData();
				} else {
					createTempFile(function(fileEntry) {
						zipFileEntry = fileEntry;
						writer = new zip.FileWriter(zipFileEntry);
						getData();
					});
				}
			}
		};
	})();

	function getTotalReadFileProgress() {
		var totalProgress = 0;
		Object.entries(fileProcessProgress).forEach(function(progressEntry, index) {
			totalProgress += progressEntry[1].readText;
		})
		return totalProgress / Object.keys(fileProcessProgress).length;
	}

	function areAllFilesProcessed() {
		var allProcessed = true;
		Object.entries(fileProcessProgress).forEach(function(progressEntry, index) {
			allProcessed = allProcessed && progressEntry[1].processText;
		})
		return allProcessed;
	}

	function makeDOMInteractive() {
		var fileInput = document.getElementById("file-input");
		var unzipProgress = document.createElement("progress");
		var fileList = document.getElementById("file-list");
		var fileProgressMeterList = document.getElementById("file-progress-meter-list");
		var fileProgressMeter = document.getElementById("file-progress-meter");
		var creationMethodInput = document.getElementById("creation-method-input");

		function download(entry, li, a) {
			model.getEntryFile(entry, creationMethodInput.value, function(blobURL) {
				var clickEvent = document.createEvent("MouseEvent");
				if (unzipProgress.parentNode)
					unzipProgress.parentNode.removeChild(unzipProgress);
				unzipProgress.value = 0;
				unzipProgress.max = 0;
				clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
				a.href = blobURL;
				a.download = entry.filename;
				a.dispatchEvent(clickEvent);
			}, function(current, total) {
				unzipProgress.value = current;
				unzipProgress.max = total;
				li.appendChild(unzipProgress);
			});
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
				
				if (activityTypeDistances[year] === undefined) {
					activityTypeDistances[year] = {};
				}
				if (activityTypeDistances[year][month] === undefined) {
					activityTypeDistances[year][month] = {};
				}

				if (activityTypeDistances[year][month][activityType]) {
					activityTypeDistances[year][month][activityType] += distance;
				} else {
					activityTypeDistances[year][month][activityType] =  distance;
				}
				
			} else if (segment?.placeVisit) {

			} else {
			}

		}  

		function handleExtractedFile(entry, index) {			
			var pathComponents = entry.filename.split("/");
			var year = pathComponents[pathComponents.length - 2]; // string
			var month = pathComponents[pathComponents.length - 1].split("_")[1].split(".")[0]; // after the '20XX_' and before the '.json'

			var progressMeter = document.createElement("span");
			progressMeter.id = "progress-meter-" + year + "-" + month;
			fileProgressMeterList.appendChild(progressMeter);

			entry.getData(new zip.TextWriter(), function(fileText) {
				var parsedSemanticHistory = JSON.parse(fileText);
				if (parsedSemanticHistory?.timelineObjects) {
					parsedSemanticHistory.timelineObjects.forEach(function(segment, index) { 
						processSegment(segment, index, year, month);
					});
					fileProcessProgress[entry.filename] = {
						readText: fileProcessProgress[entry.filename].readText,
						processText: true,
					};
					if (areAllFilesProcessed()) {
						console.log(fileProcessProgress, activityTypeDistances);
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
			

			var li = document.createElement("li");
			var a = document.createElement("a");
			a.textContent = entry.filename;
			a.href = "#";
			a.addEventListener("click", function(event) {
				if (!a.download) {
					download(entry, li, a);
					event.preventDefault();
					return false;
				}
			}, false);
			li.appendChild(a);
			fileList.appendChild(li);
		}

		function onUploadFile() {
			fileInput.disabled = true;
			model.getEntries(fileInput.files[0], function(entries) {
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
				// TODO: Filter this, then populate the progress map.
				filteredEntries.forEach(handleExtractedFile);
			});
		}

		if (typeof requestFileSystem == "undefined")
			creationMethodInput.options.length = 1;
		fileInput.addEventListener('change', onUploadFile, false);
	}
	makeDOMInteractive();

})(this);
