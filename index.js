const functions = require("firebase-functions")
const admin = require('firebase-admin')
admin.initializeApp()

const validateFirebaseIdToken = async (req, res, next) => {
  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer '))) {
    functions.logger.error(
      'No Firebase ID token was passed as a Bearer token in the Authorization header.',
      'Make sure you authorize your request by providing the following HTTP header:',
      'Authorization: Bearer <Firebase ID Token>'
    );
    res.status(403).send('Unauthorized')
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1]
  } else {
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
      }
      else if (!body.userID || typeof body.userID != "number") {
        res.status(400).send('Incorrect Payload')
      }
      else if (!body.originLat || typeof body.originLat != "number") {
        res.status(400).send('Incorrect Payload')
      }
      else if (!body.originLng || typeof body.originLng != "number") {
        res.status(400).send('Incorrect Payload')
      }
      else if (!body.destinationLat || typeof body.destinationLat != "number") {
        res.status(400).send('Incorrect Payload')
      }
      else if (!body.destinationLng || typeof body.destinationLng != "number") {
        res.status(400).send('Incorrect Payload')
      }
      else if (!body.travelTime_distance || typeof body.travelTime_distance != "string") {
        res.status(400).send('Incorrect Payload')
      }
      else if (!body.travelTime_cost || typeof body.travelTime_cost != "number") {
        res.status(400).send('Incorrect Payload')
      }
      else if (!body.travelTime_time || typeof body.travelTime_time != "string") {
        res.status(400).send('Incorrect Payload')
      }
      else if (!body.ride_type || typeof body.ride_type != "string") {
        res.status(400).send('Incorrect Payload')
      }

      //Upload Data to server
      //Get List
      //

      res.status(200).send("Response From Server: " + request.body)
      return true
    }

    else {
      res.status(401).send('You are not an authorized')
      return false
    }
  }
});


function writeToDB() {

}



// Function takes in two positions (lat, long) and calculates straight line distance in Miles
function distanceMatrix(lat1, lon1, lat2, lon2) {
  if ((lat1 === lat2) && (lon1 === lon2)) {
    return 0;
  }
  else {
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
