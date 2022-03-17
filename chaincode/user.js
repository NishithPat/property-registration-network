'use strict';

const { Contract } = require('fabric-contract-api');

class UserContract extends Contract {

    constructor() {
        super("org.property-registration-network.regnet.user");
    }

    async instantiate() {
        console.log("User contract initiated");
    }

    //user invokes the function to register himself in the network
    async requestNewUser(ctx, name, email, phoneNumber, aadharNumber) {
        if (ctx.clientIdentity.getMSPID() !== "usersMSP") {
            throw new Error("function can only be invoked by user!")
        }

        const userRequestKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.userRequest", [name + "-" + aadharNumber]);

        let newRequestUserObject = {
            name: name,
            email: email,
            phoneNumber: phoneNumber,
            aadharNumber: aadharNumber,
            createdAt: new Date()
        };

        let dataBuffer = Buffer.from(JSON.stringify(newRequestUserObject));
        await ctx.stub.putState(userRequestKey, dataBuffer);

        return newRequestUserObject;
    }

    //registered user invokes recharge amount to recharge upgrad coins
    async rechargeAccount(ctx, name, aadharNumber, bankTransactionID) {
        if (ctx.clientIdentity.getMSPID() !== "usersMSP") {
            throw new Error("function can only be invoked by user!")
        }

        const approvedUserKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedUser", [name + "-" + aadharNumber]);

        let approvedUserBuffer = await ctx.stub
            .getState(approvedUserKey)
            .catch(err => console.log(err));

        let fetchedApprovedUser = JSON.parse(approvedUserBuffer.toString());

        //depending on transactionID, upgrad coins are updated
        if (bankTransactionID === "upg100") {
            fetchedApprovedUser.upgradCoins += 100;
        } else if (bankTransactionID === "upg500") {
            fetchedApprovedUser.upgradCoins += 500;
        } else if (bankTransactionID === "upg1000") {
            fetchedApprovedUser.upgradCoins += 100;
        } else {
            throw new Error("Invalid Bank transaction ID");
        }

        let dataBuffer = Buffer.from(JSON.stringify(fetchedApprovedUser));
        await ctx.stub.putState(approvedUserKey, dataBuffer);

        return fetchedApprovedUser;
    }

    async viewUser(ctx, name, aadharNumber) {
        const approvedUserKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedUser", [name + "-" + aadharNumber]);

        let dataBuffer = await ctx.stub
            .getState(approvedUserKey)
            .catch(err => console.log(err));

        return JSON.parse(dataBuffer.toString());
    }

    //user invokes this function to register a new property in the system
    async propertyRegistrationRequest(ctx, name, aadharNumber, propertyID, price, status) {
        if (ctx.clientIdentity.getMSPID() !== "usersMSP") {
            throw new Error("function can only be invoked by user!")
        }

        const approvedUserKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedUser", [name + "-" + aadharNumber]);

        const propertyRequestKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.propertyRequest", [propertyID]);

        const propertyRequestObj = {
            propertyID: propertyID,
            owner: approvedUserKey,
            price: price,
            status: status
        }

        let propertyRequestBuffer = Buffer.from(JSON.stringify(propertyRequestObj));
        await ctx.stub.putState(propertyRequestKey, propertyRequestBuffer);

        return propertyRequestObj;
    }

    async viewProperty(ctx, propertyID) {
        const approvedPropertyKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedProperty", [propertyID]);

        let dataBuffer = await ctx.stub
            .getState(approvedPropertyKey)
            .catch(err => console.log(err));

        return JSON.parse(dataBuffer.toString());
    }

    //user invokes this function to change the status of a property to "onSale" or "registered"
    async updateProperty(ctx, name, aadharNumber, propertyID, status) {
        if (ctx.clientIdentity.getMSPID() !== "usersMSP") {
            throw new Error("function can only be invoked by user!")
        }

        const approvedUserKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedUser", [name + "-" + aadharNumber]);

        const approvedPropertyKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedProperty", [propertyID]);

        let approvedPropertyBuffer = await ctx.stub
            .getState(approvedPropertyKey)
            .catch(err => console.log(err));

        let approvedProperty = JSON.parse(approvedPropertyBuffer.toString());

        //only update property if the owner of the property is the one with the corresponding  
        //approvedUserKey derived frome the name, aadharCard function parameters
        if (approvedProperty.owner == approvedUserKey) {
            approvedProperty.status = status;
            let updatedApprovedPropertyBuffer = Buffer.from(JSON.stringify(approvedProperty));
            await ctx.stub.putState(approvedPropertyKey, updatedApprovedPropertyBuffer);

            return approvedProperty;
        } else {
            throw new Error("User is not approved to update property");
        }
    }

    //invoked by user to purchase property
    async purchaseProperty(ctx, name, aadharNumber, propertyID) {
        if (ctx.clientIdentity.getMSPID() !== "usersMSP") {
            throw new Error("function can only be invoked by user!")
        }

        let approvedPropertyKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedProperty", [propertyID]);

        let approvedPropertyBuffer = await ctx.stub
            .getState(approvedPropertyKey)
            .catch(err => console.log(err));

        let approvedProperty = JSON.parse(approvedPropertyBuffer.toString());

        let buyerKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedUser", [name + "-" + aadharNumber]);

        let buyerBuffer = await ctx.stub
            .getState(buyerKey)
            .catch(err => console.log(err));

        let buyer = JSON.parse(buyerBuffer.toString());

        //check if the property is "onSale" and the buyer has enough upgradCoins
        if (approvedProperty.status === "onSale" && approvedProperty.price <= buyer.upgradCoins) {
            let sellerKey = approvedProperty.owner;

            let sellerBuffer = await ctx.stub
                .getState(sellerKey)
                .catch(err => console.log(err));

            let seller = JSON.parse(sellerBuffer.toString());

            //update balances of upgrad coins and change the owner of the property
            seller.upgradCoins += approvedProperty.price;
            buyer.upgradCoins -= approvedProperty.price;
            approvedProperty.owner = buyerKey;

            //updating the ledger with the changes
            let updatedSellerBuffer = Buffer.from(JSON.stringify(seller));
            await ctx.stub.putState(sellerKey, updatedSellerBuffer);

            let updatedApprovedUserBuffer = Buffer.from(JSON.stringify(buyer));
            await ctx.stub.putState(buyerKey, updatedApprovedUserBuffer);

            let updatedApprovedPropertyBuffer = Buffer.from(JSON.stringify(approvedProperty));
            await ctx.stub.putState(approvedPropertyKey, updatedApprovedPropertyBuffer);
        } else {
            throw new Error("This sale is not possible");
        }
    }
}


module.exports = UserContract;