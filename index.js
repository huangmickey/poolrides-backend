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

           
      //NOTES FOR MICKEY.
      //1. If it costs money to write to a collection then we dont need to write each request to the DB
      //2. Alot of the commented out stuff is there for future, I just wrote it out to give me an idea of the workflow
        // Getting the Active Driver list should work though from my testing
      
      //I would like to turn the code below into a function in its own but I havent gotten around to changing it
      //As it stands though, it should return anything inside of the activeDrivers collection.
      var driverList;
      admin.firestore().collection("activeDrivers").get()
        .then(snapshot => {
          driverList = snapshot.docs.map(doc => {
            var driverID = doc.id;
            var obj2 = doc.data();
            var object = {driverID, ...obj2}; 
            return object;
          }); 
            console.log("Here is a list of current Drivers." + driverList);
            return driverList;
        }).catch(function(error){
          res.status(400).send('Error retrieving Drivers')
          return false;
        })

        
      // Here I have started to move the driver list to a function but haven't gotten it to work 
      // var driverList = await getActiveDriverList();   //returns list of drivers within  of driver coordinates (driverID) 
      console.log("this is the driver list" + driverList)


      if(driverList.length == 0 || driverList == false) { 

        // If list length=0. No drivers. Return false

        res.status(400).send("No Drivers On App. Sorry :(");
        return false;

      } else {

        //Else. There are drivers. Now remove those who are to far

        //In this function we will loop over the array and use Haversine to compare distances. we will return a new list with drivers who are close
        //var newDriverList = removeDrivers(driverList); 

        if(newDriverList.length == 0 || newDriverList == false) { 

          //No Drivers Nearby. Return false. Its key to recheck length as we might not have any nearby

          res.status(400).send("No Drivers nearby. Sorry :(");
          return false;

        } else {

          //Start comparing interests
          var best5Drivers = compareInterests(userID, newDriverList); 
          //We can either pass the userdata in payload but it might be easier to just call DB amnd get user Interests

          // while(!isAccepted || noDriversAccept) {
            // Now start sending FCM messages to each driver. and wait for them to return response or set a timeout 
            // and if the driver doesnt respond then move to the next. If none respond then set a var noDriversAccept = true

            // If Driver accepts
            // isAccepted = true
          // }

          //Alert the user that then have a ride or in the case that no drivers responded. respond that you couldnt find a driver

          res.status(200).send("This is a response from the server that your request has been ackowledged." + request.body)
          return true;
          } //else newDriverList.Length ==0
        }   //else driverList.Length ==0
      } else { 
        res.status(401).send('You are not authorized')
        return false
      }
  }
});














async function getActiveDriverList() {
  admin.firestore().collection("activeDrivers").get()
    .then(snapshot => {
      let driverList = snapshot.docs.map(doc => {
        var driverID = doc.id;
        var obj2 = doc.data();
        var object = {driverID, ...obj2}; 
        return object;
      }); 
        console.log("Here is a list of current Drivers." + driverList);
        return driverList;
    }).catch(function(error){
      res.status(400).send('Error retrieving Drivers')
      return false;
    })
}

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
