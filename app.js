/*
    
    Node.js express server hosting the stripe REST payment API, aswell as the paypal REST API.
    This implementation is primarily for the BattleRoyalio game by Lorenzo and some guy who didn't want credit.
    
    Developed by: TortonMind 
    Author: Lorenzo Torelli
    IDE: AWS Cloud 9
    License: MIT
    
*/
'use strict';

//Contains configurations for stripe and paypal
//#region keys, modules, etc

//API keys//
const keys = require('./keys.json');

//Modules//
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const Parse = require('parse/node');
const paypal = require('paypal-rest-sdk');

//stripe API module//
//change to keys.stripe.test if you want sandbox
const stripe = require("stripe")(keys.stripe.live.secretkey);

const app = express();

//Global Variables//
const port = 8080;

//Configurations//
app.use(bodyParser.urlencoded({ extended: false })); //Required for req.body.stripeToken. 

//if mode = sandbox, you have to change the payment.js file aswell.//
//change keys to keys.paypal.sandbox aswell
paypal.configure({
  'mode': 'live', //sandbox or live
  'client_id': keys.paypal.live.clientID,
  'client_secret': keys.paypal.live.secretID
});

    //Parse config//
Parse.initialize(keys.parse.appID,        //App ID
                keys.parse.jsID,                                         //JS key
                keys.parse.masterKey); //Master key
    //Parse url            
Parse.serverURL = keys.parse.url;
//#endregion


//App homepage//
app.get("/",(req,res) => {
        //If charge amount and acc_key queries exist in the URL string, asign them to the URL object and 
        //send the html page to the user. 
        if (req.query.chamt != undefined && req.query.acc_key != undefined){
            AccKeyVerification(req.query.acc_key)
            
                .then( (userAccount) => {

                    //If currency is valid, send html page. Otherwise, return 403 forbidden. 
                    if (CalculateCurrency(req.query.chamt) != 0) res.sendFile(path.join(`${__dirname}/en/index.html`));
                    else res.sendStatus(403);
                    
                    })
                    
                .catch( (err) => {
                    
                    res.sendStatus(403);
                    
                    return err;
                    
                    });
              
        } else res.sendStatus(403);
    
});

//Send javascript page to website//
app.get("/payment.js", (req, res) => {
    res.sendFile(path.join(`${__dirname}/en/payment.js`));
});

app.get('/payment.css', (req, res) => {
    res.sendFile(path.join(`${__dirname}/en/payment.css`));
});

//                                      //
//Change this for your logo, or whatever//
//                                      //
app.get('/tortonmind-logo-stroke.svg', (req,res) => {
    res.sendFile(path.join(`${__dirname}/en/tortonmind-logo-stroke.svg`));
});

//Send playerdata (url) to webpage javascript//
//#region Send playerdata to browser
app.post("/playerdata", (req, res) => {
   
    let data = req.body.playerData;
    data = JSON.parse(data);
    
    var returnData = {
       buying_currency: CalculateCurrency(data.chamt)
   };
   
   AccKeyVerification(data.acc_key)
    .then(function(account){
        returnData.username = account.username;
        res.send(returnData);
    });
});
//#endregion

//Get charge information from //
//For example, checks if paying with paypal or stripe. 
//#region Base controller of entire app
app.post("/charge",(req,res) => {
    
    var PlayerData = JSON.parse(req.body.playerData);
    
    if (req.body.payment == "stripe") {
        
        PlayerData.charge_type = "stripe";
        
        const token = req.body.tokenID;
    
        console.log(`Charge: ${JSON.stringify(PlayerData)}`);
    
        CreateCharges(PlayerData,token)
            .then(function(transaction) {
                res.send(ErrorSwitch(transaction));
            })
            .catch(function(error) {
                res.send(error); 
            });
        
        //console.log(`Payments work: ${req.body.payment}`);
    } 
    else if (req.body.payment == "paypal_create") {
        
        PlayerData.charge_type = "paypal";
        
        console.log(`Charge-Paypal: ${JSON.stringify(PlayerData)}`);
        CreatePaypalCharge(PlayerData)
            .then(function(payment_data){
               res.send(payment_data); 
            });
    }
    else if (req.body.payment == "paypal_execute") {
        
        PlayerData.charge_type = "paypal";
        
        const payerID = req.body.payerID;
        const paymentID = req.body.paymentID;
        
        ExecutePaypalCharge(paymentID, payerID, PlayerData)
            .then(function(transaction) {
                console.log(`Charge-paypal-end: ${JSON.stringify(PlayerData)}`);
                res.send(ErrorSwitch(transaction)); 
            })
            .catch(function(error) {
                res.send(error);
            });
        
    }
    
});
//#endregion

//Server//
app.listen(port, () => {
   console.log(`Server connection established on port ${port}.`); 
});


//Verify that the account key is valid in the database.//
//#region verify that account key is valid
var AccKeyVerification = function(acc_key){
    
    //Create an async promise (resolve, reject)
    //Sets a 1 second timeout 
    //Checks if user account exists. If it does,return username.  
    let promise = new Promise(function(resolve, reject) {
        
        setTimeout(function() {
            
            let query = new Parse.Query(Parse.User);    
            
            query.get(acc_key, {
                
                success: function(user) {
                    let userAccount = {
                        username: user.get('username'),
                        premium_currency: user.get('premium_currency')
                    };
                    resolve(userAccount);
            },
                error: function(object, error) {
                    //console.log(`${error} -- at object ${object}`);
                    reject(error);
                    
                }
            });
        },1000);
    });
    
    return promise;
};
//#endregion

//Dynamically create charges for users by passing url query information//
//Needs to have description modified
//#region Creates stripe charges
var CreateCharges = function(PlayerData, source_token){

    let promise = new Promise(function(resolveM,rejectM) {
    
        setTimeout(function(){
            var amountPaid = parseInt((PlayerData.chamt), 10);
        
            const charge = stripe.charges.create({
                    amount: amountPaid,
                    currency: 'usd',
                    description: `$${PlayerData.chamt} -- Rivvy-Coins payment for ${PlayerData.username}`,
                    source: source_token,
                    metadata:{
                        acc_key: PlayerData.acc_key,
                        username: PlayerData.username
                    } ,
                    //Transfer funds to other accounts.
                    destination: {
                        amount: Math.round((((amountPaid)/2) - (amountPaid * 0.0145) - 15)) ,
                        account: keys.stripe.transfers.riv
                        
                    }
            }, function(err, chargeObj) {
                
                //If chargeObj exists (no error)
                if (chargeObj) {
                    
                    AddCurrencyToAccount(PlayerData,chargeObj)
                        .then(function(transaction) {
                            console.log(`End charge: ${JSON.stringify(PlayerData)}`);
                            resolveM(transaction);
                        })
                        .catch(function(transaction) {
                            rejectM(transaction);
                        });
                    
                }
                
                //If there was an error, and the charge was not created.
                if (err) {
                    
                    //console.log(`CHARGE ERROR: ${err}`);
                    console.log(err);
                    rejectM(err);
                    return err;
                }
            });
        },1000);
    });
    return promise;

};
//#endregion

//Dynamically create paypal charge info//
//#region handles paypal charge creation
var CreatePaypalCharge = function(PlayerData){
    
    let promise = new Promise(function(resolve,reject){
        setTimeout(function(){
            
            let paymentPrice = (parseInt((PlayerData.chamt),10)/100).toString();
            
            let create_payment_json = {
                "intent": "sale",
                "payer": {
                    "payment_method": "paypal"
                },
                "redirect_urls": {
                    "return_url": "/complete",
                    "cancel_url": "/"
                },
                "transactions": [{
                    "item_list": {
                        "items": [{
                            "name": `Purchasing ${PlayerData.buying_currency} currency for ${PlayerData.username}`,
                            "sku": "Premium currency",
                            "price": paymentPrice,
                            "currency": "USD",
                            "quantity": 1
                        }]
                    },
                    "amount": {
                        "currency": "USD",
                        "total": paymentPrice
                    },
                    "description": `${PlayerData.buying_currency} currency for ${PlayerData.username}!`
                }]
            };
            
            paypal.payment.create(create_payment_json, function (error, payment) {
            if (error) {
                reject(error);
                throw error;
            } else {
                console.log("Create Payment Response");
                console.log(payment);
                resolve(payment);
            }
            });
        },1000);
    });
    
return promise;
};
//#endregion

//Execute paypal charge with ID provided//
//#region Execute paypal charge
var ExecutePaypalCharge = function(paymentID, payerID, PlayerData){
    
    let promise = new Promise(function(resolve,reject){
        //setTimeout(function(){
            let paymentPrice = (parseInt((PlayerData.chamt),10)/100).toString();
            
            var execute_payment_json = {
                "payer_id": payerID,
                "transactions": [{
                    "amount": {
                        "currency": "USD",
                        "total": paymentPrice 
                    }
                }]
            };
        
            var paymentId = paymentID;
            
            paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
                if (error) {
                    console.log(error.response);
                    PlayerData.transaction_result = "purchase_error";
                    throw error;
                } else {
                    console.log("Get Payment Response");
                    console.log(payment);
                    
                    AddCurrencyToAccount(PlayerData,payment)
                        .then(function(transaction) {

                            resolve(transaction);
                        })
                        .catch(function(error) {

                            reject(error);
                        });
                }
            });
        //},1000);
    });

    return promise;
};
//#endregion

//Add currency to player account//
//#region Accesses database to add currency
var AddCurrencyToAccount = function(PlayerData,chargeObj){
    
    let promise = new Promise(function(resolveM, rejectM) {
       setTimeout(function() {
            
            let query = new Parse.Query(Parse.User);
                
                query.get(PlayerData.acc_key, {
                    
                    success: function(user) {
                        
                        //Old
                       let premium_currency = user.get('premium_currency');
                       user.set('premium_currency', premium_currency + PlayerData.buying_currency);
                       user.save(null,{useMasterKey: true, sessionToken: user.get("sessionToken")})
                            .then(function(resolve) {
                                    
                                    PlayerData.transaction_result = "transaction_complete";
                                    
                                    resolveM(PlayerData.transaction_result);

                                    return resolve;
                                    
                                },function(error) {
                                    
                                    let refund_reason = {
                                        reason: 'requested_by_customer',
                                        expanded: `Saving premium currency error. Could not save to database.  ${error}`
                                    };
                                    
                                    SendRefund(chargeObj, refund_reason, PlayerData);

                                    resolveM(PlayerData.transaction_result);
                                    return error;
                                    
                                }).catch(function(reject) {
                                    
                                    let refund_reason = {
                                        reason: 'requested_by_customer',
                                        expanded: `Saving premium currency promise rejected. ${reject}`
                                    };

                                    SendRefund(chargeObj, refund_reason, PlayerData);
                                    
                                    resolveM(PlayerData.transaction_result);
                                    
                                    return reject;
                                });
                            
                    },
                    error: function(object, error) {
                        
                        PlayerData.transaction_result = "purchase_error";
                        
                        rejectM(PlayerData.transaction_result);
                        
                        return error;
                    }
            });
       },1000);
    });
    
    return promise;
};
//#endregion

//Refund if error occurs//
//#region Send refunds to player if error
var SendRefund = function(chargeObj, refund_reason, PlayerData){
    
    if (PlayerData.charge_type == "stripe") {
        stripe.refunds.create({
             
            charge: chargeObj.id,
            reverse_transfer: true,
            refund_application_fee: true,
            reason: refund_reason.reason,
            metadata: {
                reason_expanded: refund_reason.expanded
            }
            }, function(err, refund) {
     
            if (refund) {
                console.log(`Refund successful!\nAccount: ${PlayerData.username}\nAmount: ${chargeObj.amount}\n`);
            
                PlayerData.transaction_result = "refund_complete";
                return refund;
            }
            if (err){
                console.log(`ERROR IN REFUND! ${err}`);
            
                PlayerData.transaction_result = "refund_error";
                
                return err;
            }
            
        });
    }
    else if (PlayerData.charge_type == "paypal") {
        
        console.log(chargeObj);
        
        let saleid = chargeObj.transaction.related_resources.sale.id;
        let sale_amount = chargeObj.transaction.amount.total;

        console.log(saleid);
    
        let data = {
             amount: {
                total: sale_amount.toString(),
                currency: 'USD'
              }
        };

        paypal.sale.refund(saleid, data, function (error, refund){
          if (error){
            console.error(JSON.stringify(error));
            return error;
          } else {
            console.log("Refund Sale Response");
            console.log(JSON.stringify(refund));
            return refund;
          }
        });

    }
};
//#endregion

//Modify this to change how much currency is worth
//#region Currency and errors

//Check charge amount string query, and return the premium currency purchase value.//
//Modify "return" value to change how much currency is sold
var CalculateCurrency = function(chamt){
    
    switch(chamt){
        case '199' :
            return 2000;
        case '499' :
            return 6000;
        case '699' :
            return 10000;
        case '999' :
            return 19000;
        case '1299' :
            return 26000;
        default:
            return 0; //If not a listed price, return 0, meaning the currency amount is not supported. 
    }
};
//Error switch which takes in transaction info (from playerdata) and returns the appropriate response.//
var ErrorSwitch = function (transaction){
    
    switch(transaction){
        case "refund_complete":
            
            return "Sorry! We were unable to provide you with you currency!! We must have an error with out database servers.\nWe send you a refund! You should get it within 5-10 days. Feel free to contact us at support@tortonmind.com\n";
        case "refund_error":
            
            return "Oh no! We were unable to provide you with your currency, and we couldn't give you a refund!\nPlease contact us at support@tortonmind.com with your account information so we can fix the issue!\n";
        case "purchase_error":
            
            return "There was an error with your purchase. Please ensure your card is working and you have sufficient funds.\n";
        case "transaction_complete":
            
            return "Thank you for your purchase! Transaction complete! You may now close this window. We hope you enjoy your purchase!\n";
        default:
            
            return "unknown error. Please contact us at support@tortonmind.com";
    }
    //#endregion
    
};
