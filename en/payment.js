/*global StripeCheckout $*/

//EXAMPLE URL
//http://payment.tortonmind.com:8080/?chamt=999&acc_key=37lFrZcL9A
//chamt = charge amount (in cents)
//acc_key = the parse database key

var publicKeyStripe = "";

var PlayerData = {
    chamt: getQueryVariable('chamt'),
    acc_key: getQueryVariable('acc_key'),
    username: null,
    buying_currency: null,
    transaction_result: null,
    charge_type: null,
};

 //Checks if variable is a query string in the url. if so, asigns the value of the query string.
function getQueryVariable(variable) {
  	var query = window.location.search.substring(1);
  	var vars = query.split("&");
  	for (var i=0;i<vars.length;i++) {
  		var pair = vars[i].split("=");
  		if(pair[0] == variable){return pair[1];}
  	}
  	return(false);
  }

let playerData = JSON.stringify(PlayerData);

//Calls the /playerdata handler from the server
//#region playerdata and stripe payment handler
$.post('/playerdata', {playerData})
  .done(function(data){
    PlayerData.username = data.username;
    PlayerData.buying_currency = data.buying_currency;
          
    console.log(PlayerData);
    
  var handler = StripeCheckout.configure({
    key: publicKeyStripe,
    image: 'https://stripe.com/img/documentation/checkout/marketplace.png',
    locale: 'auto',
    zipCode: true,
    token: function(token) {
    	let tokenID = token.id;
    	let payment = "stripe";
    	let playerData = JSON.stringify(PlayerData);
      $.post('/charge',{tokenID, payment, playerData},(data) => {
      }).done(function(data){
        console.log(data);
        document.getElementById('confirmation').innerHTML = data;
      });
    }
  });
  
    document.getElementById('customButton').addEventListener('click', function(e) {
    handler.open({

      //                                                                      //
      //MODIFY FOR THE GAME. THIS IS WHAT POPS UP WHEN YOU OPEN STRIPE PAYMENT//
      //                                                                      //
      name: `Battle Royale`,
      description: `${PlayerData.buying_currency} ingame currency for ${PlayerData.username}`,
      currency: 'usd',
      amount: parseInt((PlayerData.chamt), 10)  //chamt = charge amount
    });
    document.getElementById('confirmation').innerHTML = 'Handling stripe transaction...Please wait';
    e.preventDefault();
  });
//#endregion

  //                             //
  //MODIFY THIS TEXT FOR THE GAME//
  //                            //
document.getElementById('info').innerHTML = `Purchasing ${PlayerData.buying_currency} Rivvy Coins for ${PlayerData.username}!`;
document.getElementById('desc').innerHTML = `You're currently buying Rivvy Coins for the TortonMind/Erigato IO games!</br></br>Rivvy Coins you purchase here will be added to your account, and be usable in all TortonMind/Erigato IO games!</br></br>Not sure what payment method to choose? Use stripe checkout if you wish to pay with a credit card, otherwise use Paypal.</br>Our servers ensure the safest stripe checkout system possible. Please contact Support@tortonmind.com if you have any issues.  `;


//#region Paypal events
window.addEventListener('popstate', function() {
    handler.close();
    
  });
  
  window.paypal.Button.render({

    //IF SANDBOX IN APP.JS, CHANGE THIS TO SANDBOX//
    env: 'production', //'production' Or 'sandbox',

    commit: true, // Show a 'Pay Now' button

    //CHANGE THIS TO MODIFY THE BUTTON//
    style: {
        size: 'small',
        color: 'silver',
        shape: 'rect',
        label: 'pay'
    },

    payment: function(data, actions) {
      
        let payment = "paypal_create";
        let playerData = JSON.stringify(PlayerData);
        return window.paypal.request.post('/charge',{payment, playerData}).then(function(data) {
              document.getElementById('confirmation').innerHTML = 'Handling paypal transaction... Please wait...'
              return data.id;
          });
    },

    onAuthorize: function(data, actions) {

      let payment = "paypal_execute";
      let playerData = JSON.stringify(PlayerData);
      return window.paypal.request.post('/charge', {
              payment, playerData,
              paymentID: data.paymentID,
              payerID:   data.payerID
          }).then(function(data) {
              document.getElementById('confirmation').innerHTML = data;
          });
    },

    onCancel: function(data, actions) {
        /* 
         * Buyer cancelled the payment 
         */
    },

    onError: function(err) {
      /* 
         * An error occurred during the transaction 
         */
       return err;
    }
  }, '#paypal-button');
//#endregion
});

