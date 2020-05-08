const functions = require("firebase-functions");
const admin = require("firebase-admin");
const request = require("graphql-request");

const client = new request.GraphQLClient(YOUR_GRAPHQL_ENDPOINT, {
  headers: {
    "content-type": "application/json",
    "x-hasura-admin-secret": YOUR_ADMIN_SECRET,
  }
});

admin.initializeApp(functions.config().firebase);

exports.registerUser = functions.https.onCall(async (data) => {
  const { email, password } = data;

  if (email === null || password === null) {
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

exports.processSignUp = functions.auth.user().onCreate(async user => {
  const { uid: id, email } = user;
  const mutation = `
    mutation($id: String!, $email: String) {
      insert_users(objects: [{
        id: $id,
        email: $email,
      }]) {
        affected_rows
      }
    }
  `;

  try {
    const data = await client.request(mutation, { id, email });

    return data;
  } catch (e) {
    throw new functions.https.HttpsError('invalid-argument', e.message);
  }
});

exports.processDelete = functions.auth.user().onDelete(async (user) => {
  const mutation = `
    mutation($id: String!) {
      delete_users(where: {id: {_eq: $id}}) {
        affected_rows
      }
    }
  `;
  const id = user.uid;

  try {
    const data = await client.request(mutation, {
      id: id,
    })
    return data;
  } catch (e) {
    throw new functions.https.HttpsError('invalid-argument', e.message);
  }
});
