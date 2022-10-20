const functions = require("firebase-functions")

const admin = require('firebase-admin')
admin.initializeApp()

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
    res.status(403).send('Unauthorized')
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1]
  } else {
    // No cookie
    res.status(403).send('Unauthorized')
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


exports.postmethod = functions.https.onRequest(async (request, res) => {
  if (request.method !== "POST") {
    res.status(405).send('HTTP Method ' + request.method + ' not allowed')
    return false
  }

  if (!request.header) {
    res.status(400).send('No Header')
    return false
  } else {

    if (await validateFirebaseIdToken(request)) {
      let body = request.body
      if (!body.userPostToken || typeof body.userPostToken != "string") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.userID || typeof body.userID != "number") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.originLat || typeof body.originLat != "number") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.originLng || typeof body.originLng != "number") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.destinationLat || typeof body.destinationLat != "number") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.destinationLng || typeof body.destinationLng != "number") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.travelTime_distance || typeof body.travelTime_distance != "string") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.travelTime_cost || typeof body.travelTime_cost != "number") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.travelTime_time || typeof body.travelTime_time != "string") {
        res.status(400).send('Incorrect Payload')
      } else if (!body.ride_type || typeof body.ride_type != "string") {
        res.status(400).send('Incorrect Payload')
      }

      var driverList = await getActiveDriverList();

      /**/console.log("======================================================================")
      /**/console.log("Results for the Active Driver List:\n")
      /**/driverList.forEach(driver => {
        /**/console.log("Driver ID: " + driver.DriverID)
        /**/console.log("Driver Push Token: " + driver.PushToken)
        /**/console.log("Driver Lat: " + driver.lat)
        /**/console.log("Driver Lng: " + driver.lng)
        /**/console.log("\n")
      /**/});
      /**/console.log(driverList.length)
      /**/console.log("======================================================================")
      /**/console.log("\n")

      if (driverList.length == 0 || driverList == false) {
        res.status(400).send("No Drivers On App. Sorry :(");
        return false;
      } else {
        var newDriverList = removeDrivers(driverList, body.originLat, body.originLng);

        /**/console.log("======================================================================")
        /**/console.log("Results for the New Shortened Driver List:\n")
        /**/newDriverList.forEach(driver => {
          /**/console.log("Driver ID: " + driver.DriverID)
          /**/console.log("Driver Push Token: " + driver.PushToken)
          /**/console.log("Driver Lat: " + driver.lat)
          /**/console.log("Driver Lng: " + driver.lng)
          /**/console.log("\n")
        /**/});
        /**/console.log(newDriverList.length)
        /**/console.log("======================================================================")
        /**/console.log("\n")
        
        if (newDriverList.length == 0 || newDriverList == false) {
          res.status(400).send("No Drivers nearby. Sorry :(");
          return false;
        } else {
          var bestDriver = compareInterests(body.userID, newDriverList, body.originLat, body.originLng);
          /**/console.log("======================================================================")
          /**/console.log("THE BEST DRIVER SELECTED ISSSSS:\n")
          /**/console.log("Driver ID: " + bestDriver.DriverID)
          /**/console.log("Driver Push Token: " + bestDriver.PushToken)
          /**/console.log("Driver Lat: " + bestDriver.lat)
          /**/console.log("Driver Lng: " + bestDriver.lng)
          /**/console.log("======================================================================")
          /**/console.log("\n")
          
          // var isAccepted = false;
          // while(!isAccepted || noDriversAccept) {
          // // Now start sending FCM messages to each driver. and wait for them to return response or set a timeout 
          // // and if the driver doesnt respond then move to the next. If none respond then set a var noDriversAccept = true

          // // If Driver accepts
          // isAccepted = true
          // }

          // //Alert the user that they have a ride or in the case that no drivers responded, respond that you couldnt find a driver
          // sendUserFCM();

          res.status(200).send("This is a response from the server that your request has been ackowledged." + request.body)
          return true;
        }


        res.status(200).send("This is a response from the server that your request has been ackowledged." + request.body)
        return true;

      } 
    } else {
      res.status(401).send('You are not authorized')
      return false
    }
  }
});


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

    if (distanceMatrix(driver.lat, driver.lng, originLat, originLng) < 10) {
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
  let bestDriver = driverList[0];
  driverList.forEach(driver => {
    if (distanceMatrix(driver.lat, driver.lng, originLat, originLng) < distanceMatrix(bestDriver.lat, bestDriver.lng, originLat, originLng)) {
      bestDriver = driver;
    }
  });
  return bestDriver
}




//NOTES FOR MICKEY.
//1. If it costs money to write to a collection then we dont need to write each request to the DB
//2. Should we get ask for a response from the rider when we alert then that they have a driver? or should we
//just end it there?
//3. Note, we are currently not using isProccessed. and I think isAccepted is used later.
//4. Alot of the commented out stuff is there for future, I just wrote it out to give me an idea of the workflow
// Getting the Active Driver list should work though from my testing     


// Old routine if in Main
// admin.firestore().collection("activeDrivers").get()
//   .then(snapshot => {
//     let driverList = snapshot.docs.map(doc => {
//       return doc.data();
//     });
//     console.log("Here is a list of current Drivers." + JSON.stringify(driverList));
//     return driverList;
//   }).catch(function (error) {
//     res.status(400).send('Error retrieving Drivers')
//     return false;
//   })