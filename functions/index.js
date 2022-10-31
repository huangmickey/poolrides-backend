const { Expo } = require('expo-server-sdk')
const functions = require("firebase-functions")

const admin = require('firebase-admin')
admin.initializeApp()
const { execSync } = require('child_process');
const { time } = require('console');

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = async (req, res, next) => {
  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer '))) {
    functions.logger.error(
      'No Firebase ID token was passed as a Bearer token in the Authorization header.',
      'Make sure you authorize your request by providing the following HTTP header:',
      'Authorization: Bearer <Firebase ID Token>',
      'or by passing a "__session" cookie.'
    );
    res.status(403).send('Server Response: Unauthorized User')
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1]
  } else {
    // No cookie
    res.status(403).send('Server Response: Unauthorized User')
    return;
  }

  let decodedIdToken
  try {
    decodedIdToken = await admin.auth().verifyIdToken(idToken)
    req.user = decodedIdToken
    return true
  } catch (error) {
    return false
  }
}

exports.requestride = functions.https.onRequest(async (request, res) => {
  if (request.method !== "POST") {
    res.status(405).send('HTTP Method ' + request.method + ' not allowed')
    return false
  }

  if (!request.header) {
    res.status(400).send('Request Error. Missing Information. How did you get here?')
    return false
  } else {

    if (await validateFirebaseIdToken(request)) {
      functions.logger.log('passed validate firebase id token')
      let body = request.body
      if (!body.riderPushToken || typeof body.riderPushToken != "string") {
        res.status(401).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.riderUID || typeof body.riderUID != "string") {
        res.status(402).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.originLat || typeof body.originLat != "number") {
        res.status(403).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.originLng || typeof body.originLng != "number") {
        res.status(404).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.originAddress || typeof body.originAddress != "string") {
        res.status(405).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.destinationLat || typeof body.destinationLat != "number") {
        res.status(406).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.destinationLng || typeof body.destinationLng != "number") {
        res.status(407).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.destinationAddress || typeof body.destinationAddress != "string") {
        res.status(408).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.travelTime_distance || typeof body.travelTime_distance != "string") {
        res.status(400).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.travelTime_cost || typeof body.travelTime_cost != "number") {
        res.status(400).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.travelTime_time || typeof body.travelTime_time != "string") {
        res.status(400).send('Server Response: Incorrect Payload')
        return;
      } else if (!body.ride_type || typeof body.ride_type != "string") {
        res.status(400).send('Server Response: Incorrect Payload')
        return;
      }

      const results = await admin.firestore().collection("rides").add({ body, isAccepted: true });
      const rideDoc = results._path.segments[1];
      console.log("Here is the ID for the ride: " + rideDoc);

      var driverList = await getActiveDriverList();
      if (driverList == false) {
        res.status(400).send('Server Error: Unable to process request at this time')
        return;
      }

      /**/console.log("======================================================================")
      /**/console.log("Results for the Active Driver List:\n")
      /**/driverList.forEach(driver => {
        /**/console.log("Driver ID: " + driver.driverID)
        /**/console.log("Driver Push Token: " + driver.driverPushToken)
        /**/console.log("Driver Lat: " + driver.lat)
        /**/console.log("Driver Lng: " + driver.lng)
        /**/console.log("\n")
        /**/
      });
      /**/console.log(driverList.length)
      /**/console.log("======================================================================")
      /**/console.log("\n")

      if (driverList.length == 0 || driverList == false) {
        res.status(400).send("Server Error: Unable to process request at this time");
        return false;
      } else {

        //This new list is a list of drivers within XXX Miles Radius
        var newDriverList = removeDrivers(driverList, body.originLat, body.originLng);

        /**/console.log("======================================================================")
        /**/console.log("Results for the New Shortened Driver List:\n")
        /**/newDriverList.forEach(driver => {
          /**/console.log("Driver ID: " + driver.driverID)
          /**/console.log("Driver Push Token: " + driver.driverPushToken)
          /**/console.log("Driver Lat: " + driver.lat)
          /**/console.log("Driver Lng: " + driver.lng)
          /**/console.log("\n")
          /**/
        });
        /**/console.log(newDriverList.length)
        /**/console.log("======================================================================")
        /**/console.log("\n")

        if (newDriverList.length == 0 || newDriverList == false) {
          res.status(400).send("Request Error. No Drivers within 25 miles. Sorry :(");
          return false;
        } else {

          var bestDriver = compareInterests(body.userID, newDriverList, body.originLat, body.originLng);

          let expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

          for (const driver of bestDriver) {

            if (!Expo.isExpoPushToken(driver.driverPushToken)) {
              console.error(`Push token ${driver.driverPushToken} is not a valid Expo push token`);
            }

            let messages = []
            messages.push({
              to: driver.driverPushToken,
              sound: 'default',
              title: 'You got a ride!',
              body: 'Press to view details',
              data: {
                riderUID: body.riderUID,
                riderPushToken: body.riderPushToken,
                origin: { lat: body.originLat, lng: body.originLng },
                originAddress: body.originAddress,
                destination: { lat: body.destinationLat, lng: body.destinationLng },
                destinationAddress: body.destinationAddress,
                travelTime_distance: body.travelTime_distance,
                travelTime_cost: body.travelTime_cost,
                travelTime_time: body.travelTime_time,
                rideDoc: rideDoc,
              },
            })

            // let receipt = await expo.sendPushNotificationsAsync(messages)
            let results = await expo.sendPushNotificationsAsync(messages)
            console.log(results);

            //Wait 15 seconds
            const date = Date.now();
            let currentDate = null;

            do {
              currentDate = Date.now();
            } while (currentDate - date < 15000);

            //Check if the ride has been accepted
            let doc = await admin.firestore().collection("rides").doc(rideDoc).get()
              .then((value) => {
                return value.get('isAccepted');
              });

            console.log("Is the ride accepted yet?: " + doc)

            if (doc) {
              res.status(200).send("This is a response from the server that your request has been ackowledged.")
              return true;
            }
          }
          res.status(409).send("Request Error. No Nearby Drivers accepted your ride. Sorry :(");
          return false;
        }
      }
    } else {
      res.status(401).send('Server Response: Unauthorized User')
      return false
    }
  }
});


async function timeout(delay) {
  return new Promise(res => setTimeout(res, delay));
  //return new Promise(res => { setTimeout(() => { res("VALUE TO RESOLVE");}, delay);});
}

async function getActiveDriverList() {
  try {
    let collection = await admin.firestore().collection("activeDrivers").get()
    return (collection.docs.map((doc) => (doc.data())));
  } catch {
    return false;
  }
}

function removeDrivers(driverList, originLat, originLng) {
  let newDriverList = [];
  driverList.forEach(driver => {

    /**/console.log("Driver ID: " + driver.DriverID)
    /**/console.log("Driver Lat: " + driver.lat)
    /**/console.log("Driver Lng: " + driver.lng)
    /**/console.log("Origin Lat: " + originLat)
    /**/console.log("Origin Lng: " + originLng)
    /**/console.log("Distance between 2 points: " + distanceMatrix(driver.lat, driver.lng, originLat, originLng) + "\n")

    if (distanceMatrix(driver.lat, driver.lng, originLat, originLng) < 25) {
      newDriverList.push(driver);
    }
  });
  return newDriverList
}

function distanceMatrix(lat1, lon1, lat2, lon2) {
  if ((lat1 === lat2) && (lon1 === lon2)) {
    return 0;
  } else {
    var radlat1 = Math.PI * lat1 / 180;
    var radlat2 = Math.PI * lat2 / 180;
    var theta = lon1 - lon2;
    var radtheta = Math.PI * theta / 180;
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;
    return dist;
  }
}

function compareInterests(userID, driverList, originLat, originLng) {
  let bestDriver = [driverList[0]];
  driverList.forEach(driver => {
    if (distanceMatrix(driver.lat, driver.lng, originLat, originLng) < distanceMatrix(bestDriver.lat, bestDriver.lng, originLat, originLng)) {
      bestDriver[0] = driver;
    }
  });
  return bestDriver
}

//Used to Cancel a ride
exports.cancelRide = functions.https.onRequest(async (request, res) => {
  if (request.method !== "POST") {
    res.status(405).send('HTTP Method ' + request.method + ' not allowed')
    return false
  }

  if (!request.header) {
    res.status(400).send('Request Error. Missing Information. How did you get here?')
    return false
  } else {

    if (await validateFirebaseIdToken(request)) {
      let body = request.body
      if (!body.userID || typeof body.userID != "string") {
        res.status(400).send('Server Response: Incorrect Payload')
        return;
      }


      //Add Code. Check if ride is accepted. If yes then notify the driver before deleting. otherwise just delete
      console.log("The user is is: " + body.userID)
      var doc = admin.firestore().collection("rides").where('body.userID', '==', body.userID);
      doc.get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
          doc.ref.delete();
        });
      });

      res.status(200).send("Ride Request Canceled")
      return true;
    } else {
      res.status(401).send('Server Response: Unauthorized User')
      return false
    }
  }
});

//Used to Cancel a ride
exports.cancelRide = functions.https.onRequest(async (request, res) => {
  if (request.method !== "POST") {
    res.status(405).send('HTTP Method ' + request.method + ' not allowed')
    return false
  }

  if (!request.header) {
    res.status(400).send('Request Error. Missing Information. How did you get here?')
    return false
  } else {

    if (await validateFirebaseIdToken(request)) {
      let body = request.body
      if (!body.riderUID || typeof body.riderUID != "string") {
        res.status(400).send('Server Response: Incorrect Payload')
        return;
      }

      //
      //Add Code. Check if ride is accepted. If yes then notify the driver before deleting. otherwise just deleted
      //

      console.log("The user is is: " + body.riderUID)
      var doc = admin.firestore().collection("rides").where('body.riderUID', '==', body.riderUID);
      doc.get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
          doc.ref.delete();
        });
      });

      res.status(200).send("Ride Request Canceled")
      return true;
    } else {
      res.status(401).send('Server Response: Unauthorized User')
      return false
    }
  }
});


/*
  IMPORTANT:
  USE THIS WHEN RUNNING FIREBASE EMULATOR.
  THIS WILL SAVE ALL DATA IN THE FIRESTORE EACH TIME ITS CLOSED AND LOAD IT EACH TIME ITS RUN.

  yarn firebase emulators:start --import=exported-dev-data --export-on-exit=exported-dev-data
*/