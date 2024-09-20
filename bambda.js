'use strict';

const aws = require('aws-sdk');

const cloudwatchLogs = new aws.CloudWatchLogs();
let coldstart = true;
const permittedFunc = ["undefined"];
const funcNames = [];

function waitFor(ms) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}

async function getFuncName(event) {
    console.log(event);
    console.log(event.body);
    const eventData = JSON.parse(event.body); 
    console.log(eventData.requestID, eventData.name);
    try {
        const logGroupName = '/aws/lambda/bambda-monitoring-dev-bambdaMonitoring';
        let logParams;
        if (coldstart === true) {
            console.log(coldstart, eventData.name, eventData.requestID); 
            logParams = { 
                logGroupName,
                startTime: Date.now() - 7 * 1000,
                endTime: Date.now(),
                filterPattern: `"Func Name: ${eventData.name}, RequestID: ${eventData.requestID}"`, 
                limit: 5 
            };
            console.log(coldstart);
            coldstart = false;
        } else {
            console.log(coldstart, eventData.name, eventData.requestID); 
            logParams = { 
                logGroupName,
                startTime: Date.now() - 1 * 1000,
                endTime: Date.now(),
                filterPattern: `"Func Name: ${eventData.name}, RequestID: ${eventData.requestID}"`,
                limit: 5 
            };
        }

        const logsData = await cloudwatchLogs.filterLogEvents(logParams).promise();
        const logEvents = logsData.events;

        logEvents.forEach(event => {
            console.log('로그 메시지:', event.message);

            const match = event.message.match(/Func Name\s*:\s*([^\s]+)/);
            if (match && match[1]) {
                console.log('Extracted Func Name:', match[1]);
                funcNames.push(match[1]); 
            }
        });

        return funcNames;

    } catch (error) {
        console.error('Error processing Lambda function:', error);
        throw new Error('Lambda function failed');
    }
}


async function compareFunc() {
    try {
        if (funcNames.length === 1) {
            const lastFuncName = funcNames[funcNames.length - 1];
            console.log(`Comparing the invoked Func Name: ${lastFuncName}`);

            const isPermissed = permittedFunc.includes(lastFuncName);

            if (isPermissed) {
                console.log(`Conflict found: The invoked Func Name "${lastFuncName}" is in the permissedFunc list.`);
                return true; 
            }

            console.log(`No conflict: The invoked Func Name "${lastFuncName}" is not in the permissedFunc list.`);
            return false;
        } else {
            console.log("No Found Func Name");
            return false;
        }
    } catch (error) {
        console.error('Error comparing function names:', error);
        throw new Error('Function name comparison failed');
    }
}

exports.handler = async (event) => {
    try {
        await getFuncName(event);
        const comparisonResult = await compareFunc();
        funcNames.length = 0;
        return comparisonResult;

    } catch (error) {
        console.error('Error during function execution:', error.message);
        return false; 
    }
};
