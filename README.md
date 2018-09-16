# IO Payment gateway

### What is this?

This is a simple payment gateway that I made primarily for browser games. It could technically be used for anything, however. 

&nbsp;

The way it works is pretty simple. It links up to your stripe, paypal, and parse database. 
When the user opens up a special url it leads them to a payment page (Which you design.) that connects directly to their account info in your parse database. 

For example: http://myBadassURL.com/?chamt=999&acc_key=37lFrZcL9A

chamt is the charge amount, and acc_key is the parse account key of the user. You need to make sure that your database has a acc_key variable. If your database uses something different for storing the unique account ID, you'll have to change all instances of acc_key in app.js and payment.js.

You'll notice that in the keys json file you can input "Transfers". These are essentially how stripe handles automatically splitting funds. The three names are random names you can delete. 

&nbsp;

### Setup

To setup the payment gateway you'll have to do the following: 

#### &nbsp; 1. Rename example_keys.json to keys.json 
#### &nbsp; 2. Add your own keys in the JSON file 
#### &nbsp; 3. In app.js, modify the stripe and paypal keys. 

FOR STRIPE: If using LIVE keys, set to ``keys.stripe.live.secretkey`` else set to ``keys.stripe.test.secretkey``

FOR PAYPAL: Set ``mode`` to ``sandbox`` OR ``live``. Set the keys accordingly. ``keys.paypal.live.clientID`` for live, ``keys.paypal.sandbox.clientID`` for sandbox/test. 

#### &nbsp; 4. In app.js look for ``CreateCharges`` and modify the ``description`` and ``destination``.

Change the description to whatever you want to show up when a user purchases something through stripe. ``destination`` is your transfers. If you don't have transfers setup, remove it. If you do want to setup a transfer, set the name from the keys file. (Or add it.) 

NOTE: You have to manually setup the amount to give them. The amount is already setup and calculated to give 50%. Stripe charges you purchase fees. 
``(amountPaid * 0.0145) - 15)`` Stripe charges 30 cents in fees when a user purchases an item, and an extra 2.9% based on the transaction. Unless you want to pay those fees yourself you need to split the fees manually across all your transfers. 

#### &nbsp; 5. In payment.js, set your stripe and paypal public keys. 

FOR STRIPE: Set ``publicKeyStripe`` to your public key. Make sure to use the proper key (Test/Live). You must use the same key type as your server.

FOR PAYPAL: Set to ``production`` or ``sandbox``, it should be at line 90. Otherwise just ctrl+f ``paypal.Button``

#### 6. &nbsp; In payment.js, finish modifying all your game-specific text/design stuff. Anything that says MODIFY in double spaced comments. This is your thank you messages, game name, etc. You can also configure the ``paypal.Button`` style configs.

At this point it should work fine. You've changed all the keys, made sure all keys were of the same type (test or live), and modified the UI text. The project comes with an index and css file, but I very strongly you just make your own.

You can either host this through express yourself, or host it on a server. 
