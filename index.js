const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.registerUser = functions.https.onCall(async (data, context) => {
  const { email, password } = data;

  if (email === null || password === null || displayName === null) {
    throw new functions.https.HttpsError("invalid-argument", "email and password are required fields");
  }

  try {
    const userRecord = await admin.auth().createUser({ email, password });

    const customClaims = {
      "https://hasura.io/jwt/claims": {
        "x-hasura-default-role": "user",
        "x-hasura-allowed-roles": ["user"],
        "x-hasura-user-id": userRecord.uid
      }
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);
    return userRecord.toJSON();

  } catch (e) {
    let errorCode = "unknown";
    let msg = "Something went wrong, please try again later";
    if (e.code === "auth/email-already-exists") {
      errorCode = "already-exists";
      msg = e.message;
    }
    throw new functions.https.HttpsError(errorCode, msg, JSON.stringify(e) );
  }
});
