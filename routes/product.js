const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");

AWS.config.update({
  region: "us-east-1",
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbTableName = "product-inventory";

// Authorization: Bearer <token>
const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers["authorization"];

  if (typeof bearerHeader !== "undefined") {
    const bearerToken = bearerHeader.split(" ")[1];
    req.token = bearerToken;
    next();
  } else {
    res.sendStatus(403);
  }
};

router.post("/api/login", (req, res) => {
  const user = {
    id: 1,
    nombre: "Prueba",
    email: "henry@gmail.com",
  };
  jwt.sign({ user: user }, "SecretKey", { expiresIn: "32s" }, (err, token) => {
    res.json({
      token: token,
    });
  });
});

router.get("/", async (req, res) => {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      id: req.query.id,
    },
  };
  await dynamodb
    .get(params)
    .promise()
    .then(
      (response) => {
        res.json(response.Item);
      },
      (error) => {
        console.error("Error: ", error);
        res.status(500).send(error);
      }
    );
});

router.get("/api/all", async (req, res) => {
  const params = {
    TableName: dynamodbTableName,
  };
  try {
    const allProducts = await scanDynamoRecords(params, []);
    const body = {
      products: allProducts,
    };
    res.json(body);
  } catch (error) {
    console.error("Error", error);
    res.status(500).send(error);
  }
});

router.post("/api/save", async (req, res) => {
  const params = {
    TableName: dynamodbTableName,
    Item: req.body,
  };
  await dynamodb
    .put(params)
    .promise()
    .then(
      () => {
        const body = {
          Operation: "SAVE",
          Message: "SUCCESS",
          Item: req.body,
        };
        res.json(body);
      },
      (error) => {
        console.error("Error ", error);
        res.status(500).send(error);
      }
    );
});

router.patch("/api/update", async (req, res) => {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      id: req.body.id,
    },
    UpdateExpression: `set ${req.body.updateKey} = :value`,
    ExpressionAttributeValues: {
      ":value": req.body.updateValue,
    },
    ReturnValues: "UPDATED_NEW",
  };
  await dynamodb
    .update(params)
    .promise()
    .then(
      (response) => {
        const body = {
          Operation: "UPDATE",
          Message: "SUCCESS",
          UpdatedAttributes: response,
        };
        res.json(body);
      },
      (error) => {
        console.error("Error:", error);
        res.status(500).send(error);
      }
    );
});

router.delete("/api/delete", async (req, res) => {
  jwt.verify(req.token, "SecretKey", async (error, authData) => {
    console.log(error);
    if (error) {
      res.sendStatus(403);
    } else {
      const params = {
        TableName: dynamodbTableName,
        Key: {
          id: req.body.id,
        },
        ReturnValues: "ALL_OLD",
      };
      await dynamodb
        .delete(params)
        .promise()
        .then(
          (response) => {
            const body = {
              Operation: "DELETE",
              Message: "SUCCESS",
              Item: response,
            };
            res.json(body);
          },
          (error) => {
            console.error("Error ", error);
            res.status(500).send(error);
          }
        );
    }
  });
});

async function scanDynamoRecords(scanParams, itemArray) {
  try {
    const dynamoData = await dynamodb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartKey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch (error) {
    throw new Error(error);
  }
}

module.exports = router;
