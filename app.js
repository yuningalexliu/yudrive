function video () {

	window.addEventListener('DOMContentLoaded', function() {
		var isStreaming = false,
			v = document.getElementById('v'),
			c = document.getElementById('c'),
			con = c.getContext('2d');
			w = 600, 
			h = 420,

		// Cross browser
		navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
		if (navigator.getUserMedia) {
			// Request access to video only
			navigator.getUserMedia(
				{
					video:true,
					audio:false
				},		
				function(stream) {
					// Cross browser checks
					var url = window.URL || window.webkitURL;
        			v.src = url ? url.createObjectURL(stream) : stream;
        			// Set the video to play
        			v.play();
				},
				function(error) {
					alert('Something went wrong. (error code ' + error.code + ')');
					return;
				}
			);
		}
		else {
			alert('Sorry, the browser you are using doesn\'t support getUserMedia');
			return;
		}

		// Wait until the video stream can play
		v.addEventListener('canplay', function(e) {
		    if (!isStreaming) {
		    	// videoWidth isn't always set correctly in all browsers
		    	if (v.videoWidth > 0) h = v.videoHeight / (v.videoWidth / w);
				c.setAttribute('width', w);
				c.setAttribute('height', h);
				// Reverse the canvas image
				con.translate(w, 0);
  				con.scale(-1, 1);
		      	isStreaming = true;
		    }
		}, false);

		// Wait for the video to start to play
		v.addEventListener('play', function() {

			var detector;

			if (!detector) {
				var width = 80;
				var height = 80;
				detector = new objectdetect.detector(width, height, 1.1, objectdetect.handfist);
			}
			
			console.log(detector);
			
			// Every 33 milliseconds copy the video image to the canvas
			setInterval(function() {
				if (v.paused || v.ended) return;
				con.fillRect(0, 0, w, h);
				con.drawImage(v, 0, 0, w, h);

				var coords = detector.detect(v, 1);
				if (coords[0]) {
					console.log("COORDS[0]", coords[0]);
					var coord = coords[0];
					
					/* Rescale coordinates from detector to video coordinate space: */
					coord[0] *= video.videoWidth / detector.canvas.width;
					coord[1] *= video.videoHeight / detector.canvas.height;
					coord[2] *= video.videoWidth / detector.canvas.width;
					coord[3] *= video.videoHeight / detector.canvas.height;

					/* Find coordinates with maximum confidence: */
					var coord = coords[0];
					for (var i = coords.length - 1; i >= 0; --i)
						if (coords[i][4] > coord[4]) coord = coords[i];
				}

			}, 1000);

		}, false);


	});
}

video();

/**
 * Real-time object detector based on the Viola Jones Framework.
 * Compatible to OpenCV Haar Cascade Classifiers (stump based only).
 * 
 * Copyright (c) 2012, Martin Tschirsich

 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
var objectdetect = (function() {
	"use strict";
    	
    var /**
		 * Converts from a 4-channel RGBA source image to a 1-channel grayscale
		 * image. Corresponds to the CV_RGB2GRAY OpenCV color space conversion.
		 * 
		 * @param {Array} src   4-channel 8-bit source image
		 * @param {Array} [dst] 1-channel 32-bit destination image
		 * 
		 * @return {Array} 1-channel 32-bit destination image
		 */
		convertRgbaToGrayscale = function(src, dst) {
			var srcLength = src.length;
			if (!dst) dst = new Uint32Array(srcLength >> 2);
			
			for (var i = 0; i < srcLength; i += 4) {
				dst[i >> 2] = (src[i] * 4899 + src[i + 1] * 9617 + src[i + 2] * 1868 + 8192) >> 14;
			}
			return dst;
		},
		
		/**
		 * Reduces the size of a given image by the given factor. Does NOT 
		 * perform interpolation. If interpolation is required, prefer using
		 * the drawImage() method of the <canvas> element.
		 * 
		 * @param {Array}  src       1-channel source image
		 * @param {Number} srcWidth	 Width of the source image
		 * @param {Number} srcHeight Height of the source image
		 * @param {Number} factor    Scaling down factor (> 1.0)
		 * @param {Array}  [dst]     1-channel destination image
		 * 
		 * @return {Array} 1-channel destination image
		 */
		rescaleImage = function(src, srcWidth, srcHeight, factor, dst) {
			var srcLength = srcHeight * srcWidth,
				dstWidth = ~~(srcWidth / factor),
				dstHeight = ~~(srcHeight / factor);
			
			if (!dst) dst = new src.constructor(dstWidth * srcHeight);
			
			for (var x = 0; x < dstWidth; ++x) {
				var dstIndex = x;
				for (var srcIndex = ~~(x * factor), srcEnd = srcIndex + srcLength; srcIndex < srcEnd; srcIndex += srcWidth) {
					dst[dstIndex] = src[srcIndex];
					dstIndex += dstWidth;
				}
			}
			
			var dstIndex = 0;
			for (var y = 0, yEnd = dstHeight * factor; y < yEnd; y += factor) {
				for (var srcIndex = ~~(y) * dstWidth, srcEnd=srcIndex + dstWidth; srcIndex < srcEnd; ++srcIndex) {
					dst[dstIndex] = dst[srcIndex];
					++dstIndex;
				}
			}
			return dst;
		},
		
		/**
		 * Horizontally mirrors a 1-channel source image.
		 * 
		 * @param {Array}  src       1-channel source image
		 * @param {Number} srcWidth  Width of the source image
		 * @param {Number} srcHeight Height of the source image
		 * @param {Array} [dst]      1-channel destination image
		 * 
		 * @return {Array} 1-channel destination image
		 */
		mirrorImage = function(src, srcWidth, srcHeight, dst) {
			if (!dst) dst = new src.constructor(src.length);
			
			var index = 0;
			for (var y = 0; y < srcHeight; ++y) {
				for (var x = (srcWidth >> 1); x >= 0; --x) {
					var swap = src[index + x];
					dst[index + x] = src[index + srcWidth - 1 - x];
					dst[index + srcWidth - 1 - x] = swap;
				}
				index += srcWidth;
			}
			return dst;
		},
		
		/**
		 * Computes the gradient magnitude using a sobel filter after
		 * applying gaussian smoothing (5x5 filter size). Useful for canny
		 * pruning.
		 * 
		 * @param {Array}  src      1-channel source image
		 * @param {Number} srcWidth Width of the source image
		 * @param {Number} srcWidth Height of the source image
		 * @param {Array}  [dst]    1-channel destination image
		 * 
		 * @return {Array} 1-channel destination image
		 */
		computeCanny = function(src, srcWidth, srcHeight, dst) {
			var srcLength = src.length;
			if (!dst) dst = new src.constructor(srcLength);
			var buffer1 = dst === src ? new src.constructor(srcLength) : dst;
			var buffer2 = new src.constructor(srcLength);
			
			// Gaussian filter with size=5, sigma=sqrt(2) horizontal pass:
			for (var x = 2; x < srcWidth - 2; ++x) {
				var index = x;
				for (var y = 0; y < srcHeight; ++y) {
					buffer1[index] =
						0.1117 * src[index - 2] +
						0.2365 * src[index - 1] +
						0.3036 * src[index] +
						0.2365 * src[index + 1] +
						0.1117 * src[index + 2];
					index += srcWidth;
				}
			}
			
			// Gaussian filter with size=5, sigma=sqrt(2) vertical pass:
			for (var x = 0; x < srcWidth; ++x) {
				var index = x + srcWidth;
				for (var y = 2; y < srcHeight - 2; ++y) {
					index += srcWidth;
					buffer2[index] =
						0.1117 * buffer1[index - srcWidth - srcWidth] +
						0.2365 * buffer1[index - srcWidth] +
						0.3036 * buffer1[index] +
						0.2365 * buffer1[index + srcWidth] +
						0.1117 * buffer1[index + srcWidth + srcWidth];
				}
			}
			
			// Compute gradient:
			var abs = Math.abs;
			for (var x = 2; x < srcWidth - 2; ++x) {
				var index = x + srcWidth;
				for (var y = 2; y < srcHeight - 2; ++y) {
					index += srcWidth;
					
					dst[index] = 
						abs(-     buffer2[index - 1 - srcWidth]
							+     buffer2[index + 1 - srcWidth]
							- 2 * buffer2[index - 1]
							+ 2 * buffer2[index + 1]
							-     buffer2[index - 1 + srcWidth]
							+     buffer2[index + 1 + srcWidth]) +
						
						abs(      buffer2[index - 1 - srcWidth]
							+ 2 * buffer2[index - srcWidth]
							+     buffer2[index + 1 - srcWidth]
							-     buffer2[index - 1 + srcWidth]
							- 2 * buffer2[index + srcWidth]
							-     buffer2[index + 1 + srcWidth]);
				}
			}
			return dst;
		},

		/**
		 * Computes the integral image of a 1-channel image. Arithmetic
		 * overflow may occur if the integral exceeds the limits for the
		 * destination image values ([0, 2^32-1] for an unsigned 32-bit image).
		 * The integral image is 1 pixel wider both in vertical and horizontal
		 * dimension compared to the source image.
		 * 
		 * SAT = Summed Area Table.
		 * 
		 * @param {Array}       src       1-channel source image
		 * @param {Number}      srcWidth  Width of the source image
		 * @param {Number}      srcHeight Height of the source image
		 * @param {Uint32Array} [dst]     1-channel destination image
		 * 
		 * @return {Uint32Array} 1-channel destination image
		 */
		computeSat = function(src, srcWidth, srcHeight, dst) {
			var dstWidth = srcWidth + 1;
			
			if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);
			
			for (var i = srcHeight * dstWidth; i >= 0; i -= dstWidth)
				dst[i] = 0;
			
			for (var x = 1; x <= srcWidth; ++x) {
				var column_sum = 0;
				var index = x;
				dst[x] = 0;
				
				for (var y = 1; y <= srcHeight; ++y) {
					column_sum += src[index - y];
					index += dstWidth;
					dst[index] = dst[index - 1] + column_sum;
				}
			}
			return dst;
		},
		
		/**
		 * Computes the squared integral image of a 1-channel image.
		 * @see computeSat()
		 * 
		 * @param {Array}       src       1-channel source image
		 * @param {Number}      srcWidth  Width of the source image
		 * @param {Number}      srcHeight Height of the source image
		 * @param {Uint32Array} [dst]     1-channel destination image
		 * 
		 * @return {Uint32Array} 1-channel destination image
		 */
		computeSquaredSat = function(src, srcWidth, srcHeight, dst) {
			var dstWidth = srcWidth + 1;
		
			if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);
			
			for (var i = srcHeight * dstWidth; i >= 0; i -= dstWidth)
				dst[i] = 0;
			
			for (var x = 1; x <= srcWidth; ++x) {
				var column_sum = 0;
				var index = x;
				dst[x] = 0;
				for (var y = 1; y <= srcHeight; ++y) {
					var val = src[index - y];
					column_sum += val * val;
					index += dstWidth;
					dst[index] = dst[index - 1] + column_sum;
				}
			}
			return dst;
		},
		
		/**
		 * Computes the rotated / tilted integral image of a 1-channel image.
		 * @see computeSat()
		 * 
		 * @param {Array}       src       1-channel source image
		 * @param {Number}      srcWidth  Width of the source image
		 * @param {Number}      srcHeight Height of the source image
		 * @param {Uint32Array} [dst]     1-channel destination image
		 * 
		 * @return {Uint32Array} 1-channel destination image
		 */
		computeRsat = function(src, srcWidth, srcHeight, dst) {
			var dstWidth = srcWidth + 1,
				srcHeightTimesDstWidth = srcHeight * dstWidth;
				
			if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);
			
			for (var i = srcHeightTimesDstWidth; i >= 0; i -= dstWidth)
				dst[i] = 0;
			
			for (var i = dstWidth - 1; i >= 0; --i)
				dst[i] = 0;
			
			var index = 0;
			for (var y = 0; y < srcHeight; ++y) {
				for (var x = 0; x < srcWidth; ++x) {
					dst[index + dstWidth + 1] = src[index - y] + dst[index];
					++index;
				}
				dst[index + dstWidth] += dst[index];
				index++;
			}
			
			for (var x = srcWidth - 1; x > 0; --x) {
				var index = x + srcHeightTimesDstWidth;
				for (var y = srcHeight; y > 0; --y) {
					index -= dstWidth;
					dst[index + dstWidth] += dst[index] + dst[index + 1];
				}
			}
			
			return dst;
		},
		
		/**
		 * Equalizes the histogram of an unsigned 1-channel image with integer 
		 * values in [0, 255]. Corresponds to the equalizeHist OpenCV function.
		 * 
		 * @param {Array}  src   1-channel integer source image
		 * @param {Number} step  Sampling stepsize, increase for performance
		 * @param {Array}  [dst] 1-channel destination image
		 * 
		 * @return {Array} 1-channel destination image
		 */
		equalizeHistogram = function(src, step, dst) {
			var srcLength = src.length;
			if (!dst) dst = src;
			if (!step) step = 5;
			
			// Compute histogram and histogram sum:
			var hist = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0];
			
			for (var i = 0; i < srcLength; i += step) {
				++hist[src[i]];
			}
			
			// Compute integral histogram:
			var norm = 255 * step / srcLength,
				prev = 0;
			for (var i = 0; i < 256; ++i) {
				var h = hist[i];
				prev = h += prev;
				hist[i] = h * norm; // For non-integer src: ~~(h * norm + 0.5);
			}
			
			// Equalize image:
			for (var i = 0; i < srcLength; ++i) {
				dst[i] = hist[src[i]];
			}
			return dst;
		},
		
		/**
		 * Horizontally mirrors a cascase classifier. Useful to detect mirrored
		 * objects such as opposite hands.
		 * 
		 * @param {Array} dst Cascade classifier
		 * 
		 * @return {Array} Mirrored cascade classifier
		 */
		mirrorClassifier = function(src, dst) {
			if (!dst) dst = new src.constructor(src);
			var windowWidth  = src[0];
			
			for (var i = 1, iEnd = src.length - 1; i < iEnd; ) {
				++i;
				for (var j = 0, jEnd = src[++i]; j < jEnd; ++j) {
					if (src[++i]) {		
						// Simple classifier is tilted:
						for (var kEnd = i + src[++i] * 5; i < kEnd; ) {
							dst[i + 1] = windowWidth - src[i + 1];
							var width = src[i + 3];
							dst[i + 3] = src[i + 4];
							dst[i + 4] = width;
							i += 5;
						}
					} else {
						// Simple classifier is not tilted:
						for (var kEnd = i + src[++i] * 5; i < kEnd; ) {
							dst[i + 1] = windowWidth - src[i + 1] - src[i + 3];
							i += 5;
						}
					}
					i += 3;
				}
			}
			return dst;
		},
		
		/**
		 * Compiles a cascade classifier to be applicable to images
		 * of given dimensions. Speeds-up the actual detection process later on.
		 * 
		 * @param {Array}        src    Cascade classifier
		 * @param {Number}       width  Width of the source image
		 * @param {Number}       height Height of the source image
		 * @param {Float32Array} [dst]  Compiled cascade classifier
		 * 
		 * @return {Float32Array} Compiled cascade classifier
		 */
		compileClassifier = function(src, width, height, scale, dst) {
			width += 1;
			height += 1;
			if (!dst) dst = new Float32Array(src.length);
			var dstUint32 = new Uint32Array(dst.buffer);
			
			dstUint32[0] = src[0];
			dstUint32[1] = src[1];
			var dstIndex = 1;
			for (var srcIndex = 1, iEnd = src.length - 1; srcIndex < iEnd; ) {
				dst[++dstIndex] = src[++srcIndex];
				
				var numComplexClassifiers = dstUint32[++dstIndex] = src[++srcIndex];
				for (var j = 0, jEnd = numComplexClassifiers; j < jEnd; ++j) {
					
					var tilted = dst[++dstIndex] = src[++srcIndex];
					var numFeaturesTimes2 = dstUint32[++dstIndex] = src[++srcIndex] * 3;
					if (tilted) {
						for (var kEnd = dstIndex + numFeaturesTimes2; dstIndex < kEnd; ) {						
							var featureOffset = src[srcIndex + 1] + src[srcIndex + 2] * width,
								featureWidthTimesWidth = src[srcIndex + 3] * (width + 1),
								featureHeightTimesWidth = src[srcIndex + 4] * (width - 1);
							
							dstUint32[++dstIndex] = featureOffset;
							dstUint32[++dstIndex] = featureWidthTimesWidth + (featureHeightTimesWidth << 16);
							
							dst[++dstIndex] = src[srcIndex + 5];
							srcIndex += 5;
						}
					} else {
						for (var kEnd = dstIndex + numFeaturesTimes2; dstIndex < kEnd; ) {
							var featureOffset = src[srcIndex + 1] + src[srcIndex + 2] * width,
								featureWidth = src[srcIndex + 3],
								featureHeightTimesWidth = src[srcIndex + 4] * width;

							dstUint32[++dstIndex] = featureOffset;
							dstUint32[++dstIndex] = featureWidth + (featureHeightTimesWidth << 16);
							dst[++dstIndex] = src[srcIndex + 5];
							srcIndex += 5;
						}
					}
					var classifierThreshold = src[++srcIndex];
					for (var k = 0; k < numFeaturesTimes2;) {
						dst[dstIndex - k] /= classifierThreshold;
						k += 3;
					}

					if ((classifierThreshold < 0)) {
						dst[dstIndex + 2] = src[++srcIndex];
						dst[dstIndex + 1] = src[++srcIndex];
						dstIndex += 2;
					} else {
						dst[++dstIndex] = src[++srcIndex];
						dst[++dstIndex] = src[++srcIndex];
					}
				}
			}
			return dst.subarray(0, dstIndex+1);
		},
		
		/**
		 * Evaluates a compiled cascade classifier. Sliding window approach.
		 * 
		 * @param {Uint32Array}  sat        SAT of the source image
		 * @param {Uint32Array}  rsat       Rotated SAT of the source image
		 * @param {Uint32Array}  ssat       Squared SAT of the source image
		 * @param {Uint32Array}  [cannySat] SAT of the canny source image
		 * @param {Number}       width      Width of the source image
		 * @param {Number}       height     Height of the source image
		 * @param {Number}       step       Stepsize, increase for performance
		 * @param {Float32Array} classifier Compiled cascade classifier
		 * 
		 * @return {Array} Rectangles representing detected objects
		 */
		detect = function(sat, rsat, ssat, cannySat, width, height, step, classifier) {
			width  += 1;
			height += 1;
			
			var classifierUint32 = new Uint32Array(classifier.buffer),
				windowWidth  = classifierUint32[0],
				windowHeight = classifierUint32[1],
				windowHeightTimesWidth = windowHeight * width,
				area = windowWidth * windowHeight,
				inverseArea = 1 / area,
				widthTimesStep = width * step,
				rects = [];
			
			for (var x = 0; x + windowWidth < width; x += step) {
				var satIndex = x;
				for (var y = 0; y + windowHeight < height; y += step) {					
					var satIndex1 = satIndex + windowWidth,
						satIndex2 = satIndex + windowHeightTimesWidth,
						satIndex3 = satIndex2 + windowWidth,
						canny = false;

					// Canny test:
					if (cannySat) {
						var edgesDensity = (cannySat[satIndex] -
											cannySat[satIndex1] -
											cannySat[satIndex2] +
											cannySat[satIndex3]) * inverseArea;
						if (edgesDensity < 60 || edgesDensity > 200) {
							canny = true;
							satIndex += widthTimesStep;
							continue;
						}
					}
					
					// Normalize mean and variance of window area:
					var mean = (sat[satIndex] -
							    sat[satIndex1] -
						        sat[satIndex2] +
						        sat[satIndex3]),
						
						variance = (ssat[satIndex] -
						            ssat[satIndex1] -
						            ssat[satIndex2] +
						            ssat[satIndex3]) * area - mean * mean,
						            
						std = variance > 1 ? Math.sqrt(variance) : 1,
						found = true;
					
					// Evaluate cascade classifier aka 'stages':
					for (var i = 1, iEnd = classifier.length - 1; i < iEnd; ) {
						var complexClassifierThreshold = classifier[++i];
						// Evaluate complex classifiers aka 'trees':
						var complexClassifierSum = 0;
						for (var j = 0, jEnd = classifierUint32[++i]; j < jEnd; ++j) {
							
							// Evaluate simple classifiers aka 'nodes':
							var simpleClassifierSum = 0;
							
							if (classifierUint32[++i]) {
								// Simple classifier is tilted:
								for (var kEnd = i + classifierUint32[++i]; i < kEnd; ) {
									var f1 = satIndex + classifierUint32[++i],
										packed = classifierUint32[++i],
										f2 = f1 + (packed & 0xFFFF),
										f3 = f1 + (packed >> 16 & 0xFFFF);
									
									simpleClassifierSum += classifier[++i] *
										(rsat[f1] - rsat[f2] - rsat[f3] + rsat[f2 + f3 - f1]);
								}
							} else {
								// Simple classifier is not tilted:
								for (var kEnd = i + classifierUint32[++i]; i < kEnd; ) {
									var f1 = satIndex + classifierUint32[++i],
										packed = classifierUint32[++i],
										f2 = f1 + (packed & 0xFFFF),
										f3 = f1 + (packed >> 16 & 0xFFFF);
									
									simpleClassifierSum += classifier[++i] *
										(sat[f1] - sat[f2] - sat[f3] + sat[f2 + f3 - f1]);
								}
							}
							complexClassifierSum += classifier[i + (simpleClassifierSum > std ? 2 : 1)];
							i += 2;
						}
						if (complexClassifierSum < complexClassifierThreshold) {
							found = false;
							break;
						}
					}
					if (found) rects.push([x, y, windowWidth, windowHeight]);
					satIndex += widthTimesStep;
				}
			}
			return rects;
		},
	    
		/**
		 * Groups rectangles together using a rectilinear distance metric. For
		 * each group of related rectangles, a representative mean rectangle
		 * is returned.
		 * 
		 * @param {Array}  rects        Rectangles (Arrays of 4 floats)
		 * @param {Number} minNeighbors
		 *  
		 * @return {Array} Mean rectangles (Arrays of 4 floats)
		 */
		groupRectangles = function(rects, minNeighbors, confluence) {
			var rectsLength = rects.length;
			if (!confluence) confluence = 1.0;
			
	    	// Partition rects into similarity classes:
	    	var numClasses = 0;
	    	var labels = new Array(rectsLength);
			for (var i = 0; i < labels.length; ++i) {
				labels[i] = 0;
			}
			
			for (var i = 0; i < rectsLength; ++i) {
				var found = false;
				for (var j = 0; j < i; ++j) {
					
					// Determine similarity:
					var rect1 = rects[i];
					var rect2 = rects[j];
			        var delta = confluence * (Math.min(rect1[2], rect2[2]) + Math.min(rect1[3], rect2[3]));
			        if (Math.abs(rect1[0] - rect2[0]) <= delta &&
			        	Math.abs(rect1[1] - rect2[1]) <= delta &&
			        	Math.abs(rect1[0] + rect1[2] - rect2[0] - rect2[2]) <= delta &&
			        	Math.abs(rect1[1] + rect1[3] - rect2[1] - rect2[3]) <= delta) {
						
						labels[i] = labels[j];
						found = true;
						break;
					}
				}
				if (!found) {
					labels[i] = numClasses++;
				}
			}
			
			// Compute average rectangle (group) for each cluster:
			var groups = new Array(numClasses);
			
			for (var i = 0; i < numClasses; ++i) {
				groups[i] = [0, 0, 0, 0, 0];
			}
			
			for (var i = 0; i < rectsLength; ++i) {
				var rect = rects[i],
					group = groups[labels[i]];
				group[0] += rect[0];
				group[1] += rect[1];
				group[2] += rect[2];
				group[3] += rect[3];
				++group[4];
			}
			
			for (var i = numClasses - 1; i >= 0; --i) {
				var numNeighbors = groups[i][4];
				if (numNeighbors >= minNeighbors) {
					var group = groups[i];
					group[0] /= numNeighbors;
					group[1] /= numNeighbors;
					group[2] /= numNeighbors;
					group[3] /= numNeighbors;
				} else groups.splice(i, 1);
			}
			
			// Filter out small rectangles inside larger rectangles:
			var filteredGroups = [];
			for (var i = 0; i < numClasses; ++i) {
		        var r1 = groups[i];
		        
		        for (var j = 0; j < numClasses; ++j) {
		        	if (i === j) continue;
		            var r2 = groups[j];
		            var dx = r2[2] * 0.2;
		            var dy = r2[3] * 0.2;
		            
		            if (r1[0] >= r2[0] - dx &&
		                r1[1] >= r2[1] - dy &&
		                r1[0] + r1[2] <= r2[0] + r2[2] + dx &&
		                r1[1] + r1[3] <= r2[1] + r2[3] + dy) {
		            	break;
		            }
		        }
		        
		        if (j === numClasses) {
		        	filteredGroups.push(r1);
		        }
		    }
			return filteredGroups;
		};
	
	var detector = (function() {
		
		/**
		 * Creates a new detector - basically a convenient wrapper class around
		 * the js-objectdetect functions and hides away the technical details
		 * of multi-scale object detection on image, video or canvas elements.
		 * 
		 * @param width       Width of the detector
		 * @param height      Height of the detector
		 * @param scaleFactor Scaling factor for multi-scale detection
		 * @param classifier  Compiled cascade classifier
		 */
		function detector(width, height, scaleFactor, classifier) {
			this.canvas = document.createElement('canvas');
			this.canvas.width = width;
			this.canvas.height = height;
			this.context = this.canvas.getContext('2d');
			this.tilted = classifier.tilted;
			this.scaleFactor = scaleFactor;
			this.numScales = ~~(Math.log(Math.min(width / classifier[0], height / classifier[1])) / Math.log(scaleFactor));
			this.scaledGray = new Uint32Array(width * height);
			this.compiledClassifiers = [];
			var scale = 1;
			for (var i = 0; i < this.numScales; ++i) {
				var scaledWidth = ~~(width / scale);
				var scaledHeight = ~~(height / scale);
				this.compiledClassifiers[i] = objectdetect.compileClassifier(classifier, scaledWidth, scaledHeight);
				scale *= scaleFactor;
			}
		}
		
		/**
		 * Multi-scale object detection on image, video or canvas elements. 
		 * 
		 * @param image          HTML image, video or canvas element
		 * @param [group]        Detection results will be grouped by proximity
		 * @param [stepSize]     Increase for performance
		 * 
		 * @return Grouped rectangles
		 */
		detector.prototype.detect = function(image, group, stepSize) {
			if (!stepSize) stepSize = 1;
			
			var width = this.canvas.width;
			var height = this.canvas.height;
			
			this.context.drawImage(image, 0, 0, width, height);
			var imageData = this.context.getImageData(0, 0, width, height).data;
			this.gray = objectdetect.convertRgbaToGrayscale(imageData, this.gray);
			
			var rects = [];
			var scale = 1;
			for (var i = 0; i < this.numScales; ++i) {
				var scaledWidth = ~~(width / scale);
				var scaledHeight = ~~(height / scale);
				
				if (scale == 1) {
					this.scaledGray.set(this.gray);
				} else {
					this.scaledGray = objectdetect.rescaleImage(this.gray, width, height, scale, this.scaledGray);
				}
				
				this.sat = objectdetect.computeSat(this.scaledGray, scaledWidth, scaledHeight, this.sat);
				this.ssat = objectdetect.computeSquaredSat(this.scaledGray, scaledWidth, scaledHeight, this.ssat);
				if (this.tilted) this.rsat = objectdetect.computeRsat(this.scaledGray, scaledWidth, scaledHeight, this.rsat);
				this.cannysat = undefined;

				var newRects = detect(this.sat, this.rsat, this.ssat, this.cannysat, scaledWidth, scaledHeight, stepSize, this.compiledClassifiers[i]);
				for (var j = newRects.length - 1; j >= 0; --j) {
					newRects[j][0] *= width / scaledWidth;
					newRects[j][1] *= height / scaledHeight;
					newRects[j][2] *= width / scaledWidth;
					newRects[j][3] *= height / scaledHeight;
				}
				rects = rects.concat(newRects);
				
				scale *= this.scaleFactor;
			}				
			return (group ? objectdetect.groupRectangles(rects, group) : rects).sort(function(r1, r2) {return r2[4] - r1[4];});
		};
		
		return detector;
	})();
	
	return {
		convertRgbaToGrayscale: convertRgbaToGrayscale,
		rescaleImage: rescaleImage,
		mirrorImage: mirrorImage,
		computeCanny: computeCanny,
		equalizeHistogram: equalizeHistogram,
		computeSat: computeSat,
		computeRsat: computeRsat,
		computeSquaredSat: computeSquaredSat,
		mirrorClassifier: mirrorClassifier,
		compileClassifier: compileClassifier,
		detect: detect,
		groupRectangles: groupRectangles,
		detector: detector
	};
})();

(function(module) {
	"use strict";
	
    var classifier = [24,24,-0.3911409080028534,2,0,2,3,3,9,16,-1.,3,7,9,8,2.,-0.0223442204296589,0.7737345099449158,-0.9436557292938232,0,2,0,9,12,5,-1.,6,9,6,5,2.,-9.3714958056807518e-003,0.5525149106979370,-0.9004204869270325,-0.8027257919311523,5,0,3,12,14,12,10,-1.,12,14,6,5,2.,18,19,6,5,2.,0.0127444602549076,-0.7241874933242798,0.5557708144187927,0,2,2,4,16,8,-1.,2,8,16,4,2.,-0.0203973893076181,0.3255875110626221,-0.9134256243705750,0,2,9,6,15,14,-1.,9,13,15,7,2.,1.5015050303190947e-003,-0.8422530293464661,0.2950277030467987,0,2,0,10,10,5,-1.,5,10,5,5,2.,-9.5540005713701248e-003,0.2949278056621552,-0.8186870813369751,1,2,8,0,16,6,-1.,8,0,16,3,2.,-9.0454015880823135e-003,-0.9253956079483032,0.2449316978454590,-0.6695849895477295,4,1,2,11,9,9,6,-1.,14,12,3,6,3.,0.0339135192334652,-0.6010565757751465,0.5952491760253906,0,2,15,1,8,10,-1.,15,6,8,5,2.,-6.3976310193538666e-003,0.2902083992958069,-0.9008722901344299,0,2,12,23,12,1,-1.,18,23,6,1,2.,3.5964029375463724e-003,-0.6108912825584412,0.3585815131664276,0,2,0,8,16,11,-1.,8,8,8,11,2.,3.1002631294541061e-004,0.2521544992923737,-0.9231098890304565,-0.9460288882255554,4,0,2,12,22,12,2,-1.,18,22,6,2,2.,8.9982077479362488e-003,-0.6216139197349548,0.5311666131019592,1,2,6,7,10,5,-1.,6,7,5,5,2.,5.8961678296327591e-003,0.3589088022708893,-0.8741096854209900,0,2,10,8,3,2,-1.,10,9,3,1,2.,-7.3489747592248023e-005,0.2021690011024475,-0.8340616226196289,1,2,15,15,3,4,-1.,15,15,3,2,2.,-1.3183970004320145e-003,-0.8218436241149902,0.2309758067131043,-1.0588489770889282,7,0,3,4,18,20,6,-1.,4,18,10,3,2.,14,21,10,3,2.,5.8955969288945198e-003,-0.7554979920387268,0.3239434063434601,0,3,3,1,20,14,-1.,3,1,10,7,2.,13,8,10,7,2.,8.6170788854360580e-003,-0.7028874754905701,0.2782224118709564,0,2,2,11,3,9,-1.,3,14,1,3,9.,-1.5837070532143116e-003,-0.7751926779747009,0.2773326933383942,0,3,0,4,12,20,-1.,0,4,6,10,2.,6,14,6,10,2.,7.9292394220829010e-003,-0.7723438143730164,0.2167312055826187,1,2,16,15,6,2,-1.,16,15,6,1,2.,-1.4443190302699804e-003,-0.8843228220939636,0.2078661024570465,0,2,11,8,7,2,-1.,11,9,7,1,2.,-4.8251380212605000e-004,0.2337501049041748,-0.6776664853096008,0,2,20,15,4,6,-1.,22,15,2,6,2.,8.0077340826392174e-003,-0.3731102049350739,0.5163818001747131,-0.7966647148132324,5,0,2,14,19,1,2,-1.,14,20,1,1,2.,-5.8145709772361442e-005,0.3404448032379150,-0.6792302131652832,0,2,0,6,2,7,-1.,1,6,1,7,2.,-1.1419489746913314e-003,0.3598371148109436,-0.5890597105026245,1,2,8,0,10,2,-1.,8,0,5,2,2.,5.8654937893152237e-003,-0.9622359871864319,0.1721540987491608,0,2,5,8,16,7,-1.,13,8,8,7,2.,1.1028599692508578e-004,-0.7706093192100525,0.2389315962791443,0,2,2,9,14,12,-1.,9,9,7,12,2.,0.0145609602332115,0.1552716046571732,-0.8984915018081665,-1.0856239795684814,9,0,3,2,11,6,10,-1.,2,11,3,5,2.,5,16,3,5,2.,3.9159432053565979e-003,-0.7370954751968384,0.2886646091938019,0,2,0,3,4,9,-1.,2,3,2,9,2.,-4.6402178704738617e-003,0.3129867017269135,-0.5601897239685059,0,2,7,10,10,8,-1.,12,10,5,8,2.,-4.2656981386244297e-003,-0.8286197781562805,0.2132489979267120,0,3,8,16,16,8,-1.,8,16,8,4,2.,16,20,8,4,2.,7.9925684258341789e-003,-0.6752548217773438,0.2340082973241806,1,2,4,13,6,3,-1.,6,15,2,3,3.,-6.2725958414375782e-003,-0.7839264273643494,0.2019792944192886,0,2,13,3,11,18,-1.,13,12,11,9,2.,-0.0288890209048986,-0.7889788150787354,0.1651563942432404,0,2,10,7,5,4,-1.,10,9,5,2,2.,-1.5122259501367807e-003,0.1971655040979385,-0.7596625089645386,0,2,11,17,6,3,-1.,13,18,2,1,9.,4.3620187789201736e-003,0.1344974040985107,-0.9309347271919251,0,2,12,7,12,17,-1.,15,7,6,17,2.,-3.2192119397222996e-003,0.2437663972377777,-0.6044244170188904,-0.8849025964736939,8,0,2,14,18,1,2,-1.,14,19,1,1,2.,-4.3883759644813836e-005,0.3130159080028534,-0.6793813705444336,0,3,3,11,6,12,-1.,3,11,3,6,2.,6,17,3,6,2.,6.2022951897233725e-004,-0.8423554897308350,0.1801322996616364,0,2,22,13,2,7,-1.,23,13,1,7,2.,1.0972339659929276e-003,-0.4771775007247925,0.3450973927974701,1,2,16,15,1,2,-1.,16,15,1,1,2.,-2.6349889230914414e-004,-0.7629253864288330,0.2153723984956741,0,2,0,5,22,18,-1.,0,14,22,9,2.,-0.0542980991303921,-0.8849576711654663,0.1730009019374847,0,2,13,19,3,3,-1.,14,20,1,1,9.,-2.1721520461142063e-003,-0.8367894887924194,0.1638997048139572,0,2,15,0,5,2,-1.,15,1,5,1,2.,-1.6347350319847465e-003,0.3731253147125244,-0.4079189002513886,1,2,5,15,4,5,-1.,5,15,2,5,2.,-2.9642079025506973e-003,-0.7973154187202454,0.1886135041713715,-1.0250910520553589,10,0,2,12,16,2,8,-1.,12,20,2,4,2.,-2.6686030905693769e-003,0.2950133979320526,-0.6534382104873657,0,2,0,18,2,4,-1.,1,18,1,4,2.,-7.9764809925109148e-004,0.3938421010971069,-0.4435322880744934,1,2,8,3,12,4,-1.,8,3,12,2,2.,-5.1704752258956432e-003,-0.7686781883239746,0.2110860049724579,1,2,6,17,3,2,-1.,7,18,1,2,3.,-1.5294969780370593e-003,-0.8944628238677979,0.1583137959241867,0,2,1,0,10,6,-1.,6,0,5,6,2.,-6.3780639320611954e-003,0.3393965959548950,-0.4529472887516022,0,2,12,9,3,2,-1.,12,10,3,1,2.,-2.6243639877066016e-004,0.2850841879844666,-0.4983885884284973,1,2,11,1,12,11,-1.,11,1,6,11,2.,0.0361888185143471,0.2132015973329544,-0.7394319772720337,0,2,21,13,2,10,-1.,21,18,2,5,2.,7.7682351693511009e-003,-0.4052247107028961,0.4112299978733063,1,2,15,16,1,2,-1.,15,16,1,1,2.,-2.3738530580885708e-004,-0.7753518819808960,0.1911296993494034,0,3,0,11,8,8,-1.,0,11,4,4,2.,4,15,4,4,2.,4.2231627739965916e-003,-0.7229338884353638,0.1739158928394318,-0.9740471243858337,8,0,2,11,11,7,6,-1.,11,13,7,2,3.,2.9137390665709972e-003,-0.5349493026733398,0.3337337076663971,0,2,12,17,3,3,-1.,13,18,1,1,9.,-1.6270120395347476e-003,-0.8804692029953003,0.1722342073917389,0,2,0,9,2,2,-1.,1,9,1,2,2.,-2.9037619242444634e-004,0.2734786868095398,-0.5733091235160828,0,2,13,17,1,2,-1.,13,18,1,1,2.,-1.4552129869116470e-005,0.2491019070148468,-0.5995762944221497,0,2,7,0,17,18,-1.,7,9,17,9,2.,0.0141834802925587,0.1507173925638199,-0.8961830139160156,1,2,8,11,8,2,-1.,8,11,8,1,2.,-5.8600129705155268e-005,0.1771630048751831,-0.7106314897537231,0,2,18,17,6,7,-1.,21,17,3,7,2.,7.3492531664669514e-003,-0.5106546878814697,0.2574213147163391,0,2,2,19,8,1,-1.,6,19,4,1,2.,-1.7738100141286850e-003,-0.8705360293388367,0.1460683941841126,-1.4024209976196289,11,0,3,12,10,10,6,-1.,12,10,5,3,2.,17,13,5,3,2.,-8.5521116852760315e-003,0.3413020968437195,-0.4556924998760223,0,3,5,20,18,4,-1.,5,20,9,2,2.,14,22,9,2,2.,2.9570560436695814e-003,-0.5616099834442139,0.2246744036674500,0,2,1,10,22,5,-1.,12,10,11,5,2.,-0.0195402801036835,-0.8423789739608765,0.1363316029310226,1,2,1,11,12,1,-1.,1,11,6,1,2.,-3.2073149923235178e-003,-0.7569847702980042,0.1883326023817062,0,2,12,0,12,24,-1.,12,6,12,12,2.,-8.4488727152347565e-003,0.1382011026144028,-0.8026102185249329,0,2,4,15,5,6,-1.,4,17,5,2,3.,1.1350389831932262e-004,-0.7027189135551453,0.1435786038637161,1,2,12,2,6,4,-1.,14,4,2,4,3.,-5.8187649119645357e-004,-0.4507982134819031,0.2510882019996643,0,2,0,7,2,17,-1.,1,7,1,17,2.,-0.0161978900432587,0.6447368860244751,-0.2079977989196777,0,2,13,15,3,9,-1.,14,15,1,9,3.,6.6894508199766278e-004,0.1998561024665833,-0.7483944892883301,0,2,13,18,3,3,-1.,14,19,1,1,9.,-1.8372290069237351e-003,-0.8788912892341614,0.1146014034748077,0,2,17,17,1,2,-1.,17,18,1,1,2.,-4.3397278204793110e-005,0.2129840999841690,-0.5028128027915955,-1.1141099929809570,11,0,3,10,11,4,12,-1.,10,11,2,6,2.,12,17,2,6,2.,-2.0713880658149719e-003,0.2486661970615387,-0.5756726861000061,0,2,12,23,12,1,-1.,18,23,6,1,2.,3.6768750287592411e-003,-0.5755078196525574,0.2280506044626236,1,2,13,10,3,4,-1.,13,10,3,2,2.,-3.0887479078955948e-004,0.2362288981676102,-0.6454687118530273,0,3,0,0,24,24,-1.,0,0,12,12,2.,12,12,12,12,2.,-0.0257820300757885,-0.7496209144592285,0.1617882996797562,0,2,2,10,2,6,-1.,2,13,2,3,2.,-1.2850989587605000e-003,-0.7813286781311035,0.1440877020359039,0,2,0,11,2,6,-1.,0,14,2,3,2.,3.3493789378553629e-003,0.1375873982906342,-0.7505543231964111,0,2,0,1,24,1,-1.,8,1,8,1,3.,-2.6788329705595970e-003,0.2596372067928314,-0.4255296885967255,0,2,13,7,4,2,-1.,13,8,4,1,2.,-2.8834199838456698e-005,0.1635348945856094,-0.7050843238830566,0,2,0,13,3,10,-1.,1,13,1,10,3.,-1.6196980141103268e-003,0.3419960141181946,-0.3415850102901459,0,2,1,10,10,10,-1.,6,10,5,10,2.,1.0517919436097145e-003,0.1479195058345795,-0.7929052114486694,1,2,9,0,4,6,-1.,9,0,4,3,2.,-2.4886541068553925e-003,-0.8937227129936218,0.1043419018387795,-1.0776710510253906,10,0,2,16,18,1,2,-1.,16,19,1,1,2.,-5.7590808864915743e-005,0.2734906971454620,-0.6426038742065430,0,2,21,14,2,8,-1.,22,14,1,8,2.,7.1206100983545184e-004,-0.5435984134674072,0.2552855014801025,0,2,0,7,21,9,-1.,7,10,7,3,9.,-0.3888005912303925,0.6930956840515137,-0.1862079948186874,0,2,16,16,1,4,-1.,16,17,1,2,2.,2.5288251345045865e-004,0.2914173901081085,-0.5620415806770325,1,2,19,15,2,6,-1.,17,17,2,2,3.,-2.1006830502301455e-003,-0.6822040081024170,0.1185996010899544,0,2,6,0,15,4,-1.,6,1,15,2,2.,-3.2310429960489273e-003,0.3972072899341583,-0.2774995863437653,0,2,9,16,1,4,-1.,9,17,1,2,2.,1.4478569937637076e-005,-0.5476933717727661,0.2119608968496323,0,3,8,20,8,2,-1.,8,20,4,1,2.,12,21,4,1,2.,-9.0244162129238248e-004,-0.8646997213363648,0.1194489970803261,0,2,0,9,3,14,-1.,1,9,1,14,3.,-1.5906910412013531e-003,0.2919914126396179,-0.3928124904632568,1,2,11,1,11,4,-1.,11,1,11,2,2.,7.4913240969181061e-003,0.2679530084133148,-0.4020768105983734,-1.1201709508895874,11,0,2,15,20,1,2,-1.,15,21,1,1,2.,-7.1240079705603421e-005,0.2823083102703095,-0.4779424071311951,1,2,2,18,1,2,-1.,2,18,1,1,2.,-2.6417701155878603e-004,0.3084900975227356,-0.4036655128002167,0,2,0,14,12,6,-1.,0,16,12,2,3.,5.2890321239829063e-004,-0.7423822879791260,0.1605536937713623,0,3,4,10,2,14,-1.,4,10,1,7,2.,5,17,1,7,2.,3.8283021422103047e-004,-0.6108828783035278,0.1794416010379791,0,2,22,3,2,15,-1.,23,3,1,15,2.,5.4077422246336937e-003,-0.2767061889171600,0.4017147123813629,1,2,4,17,3,1,-1.,5,18,1,1,3.,-8.2620367174968123e-004,-0.8456827998161316,0.1641048043966293,0,2,21,6,3,9,-1.,21,9,3,3,3.,-8.9606801047921181e-003,-0.6698572039604187,0.1270485967397690,0,2,1,7,23,4,-1.,1,9,23,2,2.,-3.0286349356174469e-003,0.1227105036377907,-0.7880274057388306,0,2,4,3,20,20,-1.,4,13,20,10,2.,-0.0262723900377750,-0.7226560711860657,0.1347829997539520,0,2,14,13,7,4,-1.,14,15,7,2,2.,-5.0153239862993360e-004,0.2890014052391052,-0.3537223935127258,1,2,2,6,2,2,-1.,2,6,2,1,2.,-1.9847620569635183e-004,0.2491115033626556,-0.4667024016380310,-1.0063530206680298,12,0,2,13,15,6,4,-1.,13,17,6,2,2.,-1.6098109772428870e-003,0.2436411976814270,-0.5425583124160767,0,2,17,0,7,24,-1.,17,8,7,8,3.,3.0391800682991743e-003,0.1427879035472870,-0.7677937150001526,0,2,3,7,20,8,-1.,13,7,10,8,2.,-0.0111625995486975,-0.7964649796485901,0.1309580951929092,0,2,0,7,22,1,-1.,11,7,11,1,2.,-1.6689340118318796e-003,0.2306797951459885,-0.4947401881217957,0,2,7,9,8,2,-1.,7,10,8,1,2.,-8.8481552666053176e-004,0.2005017995834351,-0.5158239006996155,0,2,2,0,3,18,-1.,2,6,3,6,3.,-2.6040559168905020e-003,0.1298092007637024,-0.7818121910095215,0,2,2,13,3,5,-1.,3,13,1,5,3.,-2.3444599355570972e-004,-0.5695487260818481,0.1478334069252014,0,2,14,16,3,4,-1.,15,16,1,4,3.,8.4604357834905386e-004,0.1037243008613586,-0.8308842182159424,0,2,10,0,12,3,-1.,10,1,12,1,3.,-2.4807569570839405e-003,0.3425926864147186,-0.2719523906707764,1,2,15,16,3,1,-1.,16,17,1,1,3.,-1.1127090547233820e-003,-0.8275328278541565,0.1176175028085709,0,2,22,13,2,5,-1.,23,13,1,5,2.,1.4298419700935483e-003,-0.3477616012096405,0.2652699053287506,0,2,11,14,4,6,-1.,11,16,4,2,3.,-1.4572150539606810e-003,-0.8802363276481628,0.1092033982276917,-1.0373339653015137,13,0,2,14,15,1,2,-1.,14,16,1,1,2.,-1.4507149899145588e-005,0.2605004012584686,-0.4580149054527283,1,2,6,3,6,5,-1.,6,3,3,5,2.,0.0136784398928285,-0.7149971723556519,0.1477705985307694,1,2,2,8,1,2,-1.,2,8,1,1,2.,-7.3151881224475801e-005,0.2058611065149307,-0.4995836019515991,0,2,9,17,4,4,-1.,9,18,4,2,2.,-6.7043182207271457e-004,-0.7319483757019043,0.1358278989791870,0,2,10,6,4,5,-1.,11,6,2,5,2.,-1.1992789804935455e-003,0.4456472992897034,-0.2521241009235382,0,2,2,21,12,2,-1.,8,21,6,2,2.,-0.0117351496592164,-0.7972438931465149,0.1424607038497925,0,2,12,8,12,15,-1.,16,8,4,15,3.,-4.7361929900944233e-003,0.1624221056699753,-0.5223402976989746,0,2,0,3,20,20,-1.,0,13,20,10,2.,-0.1084595024585724,-0.7962973713874817,0.1265926957130432,1,2,16,17,4,2,-1.,16,17,4,1,2.,-3.2293208641931415e-004,-0.7129234075546265,0.0899520069360733,1,2,21,14,2,5,-1.,21,14,1,5,2.,2.5980910286307335e-003,-0.2800100147724152,0.3197942078113556,1,2,12,0,12,8,-1.,12,0,12,4,2.,-7.5798099860548973e-003,-0.7153301239013672,0.1406804025173187,0,2,17,0,7,24,-1.,17,6,7,12,2.,-8.4003582596778870e-003,0.1168404966592789,-0.6506950259208679,0,2,13,10,3,6,-1.,13,12,3,2,3.,3.6820198874920607e-003,-0.2631436884403229,0.3865979909896851,-0.9257612824440002,12,0,2,8,11,9,9,-1.,11,14,3,3,9.,0.0240733902901411,-0.4794333875179291,0.2617827057838440,0,2,17,18,7,6,-1.,17,21,7,3,2.,1.9582170061767101e-003,-0.4434475898742676,0.2301298975944519,0,2,9,8,4,2,-1.,9,9,4,1,2.,-2.0559200493153185e-004,0.1224080994725227,-0.7277694940567017,0,2,7,7,7,6,-1.,7,9,7,2,3.,1.0637210216373205e-003,-0.1582341045141220,0.6447200775146484,0,2,2,9,1,9,-1.,2,12,1,3,3.,-3.5040560760535300e-004,-0.5160586237907410,0.2033808976411820,0,2,1,0,1,20,-1.,1,10,1,10,2.,-1.5382179990410805e-003,0.2029495984315872,-0.5412080287933350,1,2,5,11,4,3,-1.,5,11,2,3,2.,4.2215911671519279e-003,0.1420246958732605,-0.6884710788726807,0,2,1,6,14,13,-1.,8,6,7,13,2.,4.0536639280617237e-003,0.0946411192417145,-0.8890265226364136,0,2,11,6,6,4,-1.,13,6,2,4,3.,3.9104130119085312e-003,-0.2211245000362396,0.4553441107273102,1,2,15,20,2,2,-1.,15,20,2,1,2.,-5.8839347911998630e-004,-0.7423400878906250,0.1466006040573120,0,2,11,7,11,2,-1.,11,8,11,1,2.,4.7331111272796988e-004,0.0803736001253128,-0.8416292071342468,0,2,14,0,7,4,-1.,14,1,7,2,2.,-1.4589539496228099e-003,0.2730404138565064,-0.2989330887794495];
    module.handfist = new Float32Array(classifier);
    module.handfist.tilted = true;
})(objectdetect);