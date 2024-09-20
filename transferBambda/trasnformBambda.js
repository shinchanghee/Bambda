const fs = require('fs');
const recast = require('recast');
const { v4: uuidv4 } = require('uuid');

function readFile(inputFilePath) {
  try {
    const data = fs.readFileSync(inputFilePath, 'utf-8');
    return data;
  } catch (err) {
    console.error('Error reading the file:', err);
    process.exit(1);
  }
}

function hasResourceAccessCode(ast) {
  const patterns = [
    /new aws\.DynamoDB\(\)/,
  ];

  let found = false;

  recast.visit(ast, {
    visitNewExpression(path) {
      const code = recast.print(path.node).code;
      if (patterns.some(pattern => pattern.test(code))) {
        found = true;
      }
      this.traverse(path);
    },
  });

  return found;
}

function writeFile(outputFilePath, data) {
  try {
    fs.writeFileSync(outputFilePath, data, 'utf-8');
    console.log('Transformed file has been saved to:', outputFilePath);
  } catch (err) {
    console.error('Error writing the file:', err);
    process.exit(1);
  }
}

function transformCode(code) {
  const ast = recast.parse(code);
  recast.visit(ast, {
    visitAssignmentExpression(path) {
      if (
        (path.node.left.type === 'MemberExpression' &&
          path.node.left.object.name === 'module' &&
          path.node.left.property.name === 'exports') ||
        (path.node.left.type === 'MemberExpression' &&
          path.node.left.object.name === 'exports' &&
          path.node.left.property.name === 'handler')
      ) {
        if (path.node.right.type === 'ObjectExpression') {
          path.node.right.properties.forEach(property => {
            if (property.value.type === 'FunctionExpression') {
              const functionBody = property.value.body.body;
              if (!hasResourceAccessCode(recast.parse(code))) {
                const cloudWatchCode = recast.parse(`
                  async function logToCloudWatch() {
                    const cloudwatchlogs = new aws.CloudWatchLogs();
                    const logGroupName = '/aws/lambda/bambda-monitoring-dev-bambdaMonitoring';
                    const logStreamName = 'log-stream-' + uuidv4();
                    const lambda = new aws.Lambda();
                    await cloudwatchlogs.createLogStream({
                      logGroupName,
                      logStreamName,
                    }).promise();
        
                    const logEvents = [
                      {
                        timestamp: Date.now(),
                        message: \`Func Name: \${context.functionName}, RequestID: \${context.awsRequestId}\`,
                      },
                    ];
        
                    await cloudwatchlogs.putLogEvents({
                      logGroupName,
                      logStreamName,
                      logEvents,
                    }).promise();
                  }
                  logToCloudWatch();
                `).program.body;

                functionBody.unshift(...cloudWatchCode);
              } else {
                const simpleLogCode = recast.parse(`
                  async function logToCloudWatch() {
                    const cloudwatchlogs = new aws.CloudWatchLogs();
                    const logGroupName = '/aws/lambda/bambda-monitoring-dev-bambdaMonitoring';
                    const logStreamName = 'log-stream-' + uuidv4();
                    const lambda = new aws.Lambda();
                    await cloudwatchlogs.createLogStream({
                        logGroupName,
                        logStreamName,
                    }).promise();
        
                    const logEvents = [
                    {
                        timestamp: Date.now(),
                        message: \`Func Name: \${context.functionName}, RequestID: \${context.awsRequestId}\`,
                    },
                    ];
        
                    await cloudwatchlogs.putLogEvents({
                        logGroupName,
                        logStreamName,
                        logEvents,
                    }).promise();
        
                    const eventData = JSON.parse(event.body);
                    if (eventData.requestID && eventData.name) {
                    // Valid event data
                    } else {
                        console.log("Not have requestID or Lambda Name");
                        return;
                    }
        
                    const lambdaRequestID = eventData.requestID;
                    const lambdaName = eventData.name;
                    const payload = JSON.stringify({
                        body: JSON.stringify({
                            requestID: lambdaRequestID,
                            name: lambdaName,
                        }),
                    });
                    const params = {
                        FunctionName: "", // Function's Bambda Name
                        InvocationType: 'RequestResponse',
                        Payload: payload
                    };
        
                    const result = await lambda.invoke(params).promise();
                    console.log(result.Payload);
                    console.log("bambda success");
        
                    if (result.Payload !== "true") {
                        console.log("우회 접속 의심");
                        return;
                    }
                  }
                  logToCloudWatch();
                `).program.body;

                functionBody.unshift(...simpleLogCode);
              }
            }
          });
        } else if (path.node.right.type === 'FunctionExpression') {
          const functionBody = path.node.right.body.body;

          if (!hasResourceAccessCode(recast.parse(code))) {
            const cloudWatchCode = recast.parse(`
              async function logToCloudWatch() {
                const cloudwatchlogs = new aws.CloudWatchLogs();
                const logGroupName = '/aws/lambda/bambda-monitoring-dev-bambdaMonitoring';
                const logStreamName = 'log-stream-' + uuidv4();
                const lambda = new aws.Lambda();
                await cloudwatchlogs.createLogStream({
                  logGroupName,
                  logStreamName,
                }).promise();
    
                const logEvents = [
                  {
                    timestamp: Date.now(),
                    message: \`Func Name: \${context.functionName}, RequestID: \${context.awsRequestId}\`,
                  },
                ];
    
                await cloudwatchlogs.putLogEvents({
                  logGroupName,
                  logStreamName,
                  logEvents,
                }).promise();
              }
              logToCloudWatch();
            `).program.body;

            functionBody.unshift(...cloudWatchCode);
          } else {
            const simpleLogCode = recast.parse(`
              async function logToCloudWatch() {
                const cloudwatchlogs = new aws.CloudWatchLogs();
                const logGroupName = '/aws/lambda/bambda-monitoring-dev-bambdaMonitoring';
                const logStreamName = 'log-stream-' + uuidv4();
                const lambda = new aws.Lambda();
                await cloudwatchlogs.createLogStream({
                    logGroupName,
                    logStreamName,
                }).promise();
    
                const logEvents = [
                {
                    timestamp: Date.now(),
                    message: \`Func Name: \${context.functionName}, RequestID: \${context.awsRequestId}\`,
                },
                ];
    
                await cloudwatchlogs.putLogEvents({
                    logGroupName,
                    logStreamName,
                    logEvents,
                }).promise();
                if (event.requestContext && event.requestContext.apiId) {
                } else {
                  const eventData = JSON.parse(event.body);
                  if (eventData.requestID && eventData.name) {
                  // Valid event data
                  } else {
                      console.log("Not have requestID or Lambda Name");
                      return;
                  }
      
                  const lambdaRequestID = eventData.requestID;
                  const lambdaName = eventData.name;
                  const payload = JSON.stringify({
                      body: JSON.stringify({
                          requestID: lambdaRequestID,
                          name: lambdaName,
                      }),
                  });
                  const params = {
                      FunctionName: "", // Function's Bambda Name
                      InvocationType: 'RequestResponse',
                      Payload: payload
                  };
      
                  const result = await lambda.invoke(params).promise();
                  console.log(result.Payload);
                  console.log("bambda success");
      
                  if (result.Payload !== "true") {
                      console.log("우회 접속 의심");
                      return;
                  }
                }
                logToCloudWatch();
              }
                
            `).program.body;

            functionBody.unshift(...simpleLogCode);
          }
        }
      }
      this.traverse(path);
    },
  });

  return recast.print(ast).code;
}

function transformFile(inputFilePath, outputFilePath) {
  const code = readFile(inputFilePath);
  const transformedCode = transformCode(code);
  writeFile(outputFilePath, transformedCode);
}


const inputFilePath = './test.js'; 
const outputFilePath = './output.js'; 

transformFile(inputFilePath, outputFilePath);
