'use strict';

const { Contract } = require('fabric-contract-api');

class RegistrarContract extends Contract {

    constructor() {
        super("org.property-registration-network.regnet.registrar");
    }

    async instantiate() {
        console.log("Registrar contract initiated");
    }

    //registrar invokes this function to approve a user to the network
    async approveNewUser(ctx, name, aadharNumber) {
        if (ctx.clientIdentity.getMSPID() !== "registrarMSP") {
            throw new Error("function can only be invoked by registrar!")
        }

        const userRequestKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.userRequest", [name + "-" + aadharNumber]);

        let userRequestBuffer = await ctx.stub
            .getState(userRequestKey)
            .catch(err => console.log(err));

        let fetchedUserRequest = JSON.parse(userRequestBuffer.toString());

        fetchedUserRequest.upgradCoins = 0;

        const approvedUserKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedUser", [name + "-" + aadharNumber]);

        let approvedUserBuffer = Buffer.from(JSON.stringify(fetchedUserRequest));
        await ctx.stub.putState(approvedUserKey, approvedUserBuffer);

        return fetchedUserRequest;
    }

    async viewUser(ctx, name, aadharNumber) {
        const approvedUserKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedUser", [name + "-" + aadharNumber]);

        let dataBuffer = await ctx.stub
            .getState(approvedUserKey)
            .catch(err => console.log(err));

        return JSON.parse(dataBuffer.toString());
    }

    //registrar checks and approves a new property in the network
    async approvePropertyRegistration(ctx, propertyID) {
        if (ctx.clientIdentity.getMSPID() !== "registrarMSP") {
            throw new Error("function can only be invoked by registrar!")
        }

        const propertyRequestKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.propertyRequest", [propertyID]);

        let propertyRequestBuffer = await ctx.stub
            .getState(propertyRequestKey)
            .catch(err => console.log(err));

        let fetchedPropertyRequest = JSON.parse(propertyRequestBuffer.toString());

        const approvedPropertyKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedProperty", [propertyID]);

        let approvedPropertyBuffer = Buffer.from(JSON.stringify(fetchedPropertyRequest));
        await ctx.stub.putState(approvedPropertyKey, approvedPropertyBuffer);

    }

    async viewProperty(ctx, propertyID) {
        const approvedPropertyKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.approvedProperty", [propertyID]);

        let dataBuffer = await ctx.stub
            .getState(approvedPropertyKey)
            .catch(err => console.log(err));

        return JSON.parse(dataBuffer.toString());
    }
}

module.exports = RegistrarContract;