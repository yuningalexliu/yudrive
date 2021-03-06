'use strict';
var gameReady = false;

var driveApp = angular.module('driveApp', []);

driveApp.controller('DriveCtrl', function ($scope, $http) {

	$scope.scoreObject = {};
	$scope.highScores;
	$scope.hasHighScore = false;

	$scope.toRegistration = function() {
		$('#instructionsModal').modal('hide');
		$('#registrationModal').modal('show');
	}

	$scope.toGame = function() {
		$('#registrationModal').modal('hide');
		setTimeout(function() {gameReady = true}, 2000);
	}

	$scope.getHighScores = function(callback) {
		console.log("Checking high scores");
		$http.get('/api/scores/high').
			success(function(data, status, headers, config) {
			  console.log("High scores retrieved ", data);
			  $scope.highScores = data;
			  callback(null, 'one');
			}).
			error(function(data, status, headers, config) {
			  console.log("Error retrieving high scores ", data);
			  callback(null, 'one');
			});
	}

	$scope.checkForHighScore = function(callback) {
		console.log("Checking if you have a high score");
		if ($scope.highScores.length < 5) {
			console.log("You have a high score!");
			$scope.hasHighScore = true;
			callback(null, 'two');
		} else {
			for (var i = 0; i < $scope.highScores.length; i++) {
				if ($scope.scoreObject.finalTimeInMilliseconds < $scope.highScores[i].finalTimeInMilliseconds) {
					console.log("You have a high score!");
					$scope.hasHighScore = true;
				}
			}
			callback(null, 'two');
		}
	}

	$scope.submitInfo = function() {
		console.log("Info submitted!");
		$http.post('/api/scores', {scoreObject: $scope.scoreObject}).
		  success(function(data, status, headers, config) {
		    console.log("Database updated ", data);
		  }).
		  error(function(data, status, headers, config) {
		    console.log("Error updating database ", data);
		  });
	}

	$scope.playAgain = function() {
		$('#myModal').modal('hide');
		$('#thankYouModal').modal('show');
		setTimeout(window.location.reload.bind(window.location), 2500);
	}
});

driveApp.filter('toFormattedTimeString', function() {
	return function(finalTimeInMilliseconds) {
		var min = Math.floor(finalTimeInMilliseconds / 60000);
		
		var sec = Math.floor((finalTimeInMilliseconds - min * 60000) / 1000); 
		if(sec < 10) sec = "0" + sec;
		
		var mili = Math.floor(finalTimeInMilliseconds - min * 60000 - sec * 1000);
		if(mili < 100) mili = "0" + mili;
		if(mili < 10) mili = "0" + mili;
		
		var formattedTimeString = ""+min+":"+sec+":"+mili;
		return formattedTimeString;
	};
})

driveApp.filter('differenceFromLastHighScore', function() {
	return function(newFinalTimeInMilliseconds, scope) {
		if (scope.highScores) {

			var differenceInTime =  newFinalTimeInMilliseconds - scope.highScores[scope.highScores.length - 1].finalTimeInMilliseconds

			var min = Math.floor(differenceInTime / 60000);
			
			var sec = Math.floor((differenceInTime - min * 60000) / 1000); 
			if(sec < 10) sec = "0" + sec;
			
			var mili = Math.floor(differenceInTime - min * 60000 - sec * 1000);
			if(mili < 100) mili = "0" + mili;
			if(mili < 10) mili = "0" + mili;
			
			var formattedTimeString = ""+min+":"+sec+":"+mili;
			return formattedTimeString;
		} else {
			return newFinalTimeInMilliseconds;
		}
	};
})