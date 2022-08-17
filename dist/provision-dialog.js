var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "@material/mwc-dialog";
import "@material/mwc-textfield";
import "@material/mwc-button";
import "@material/mwc-circular-progress";
import { hasIdentifyCapability, ImprovCurrentState, IMPROV_BLE_CURRENT_STATE_CHARACTERISTIC, IMPROV_BLE_ERROR_STATE_CHARACTERISTIC, IMPROV_BLE_RPC_COMMAND_CHARACTERISTIC, IMPROV_BLE_RPC_RESULT_CHARACTERISTIC, IMPROV_BLE_SERVICE, } from "./const";
const ERROR_ICON = "⚠️";
const OK_ICON = "🎉";
const AUTHORIZE_ICON = "👉";
const DEBUG = false;
let ProvisionDialog = class ProvisionDialog extends LitElement {
    constructor() {
        super(...arguments);
        this._state = "CONNECTING";
        this._improvErrorState = 0 /* ImprovErrorState.NO_ERROR */;
        this._improvCapabilities = 0;
        this._busy = false;
    }
    render() {
        let heading = "";
        let content;
        let hideActions = false;
        if (this._state === "CONNECTING") {
            content = this._renderProgress("Connecting");
            hideActions = true;
        }
        else if (this._state === "ERROR") {
            content = this._renderMessage(ERROR_ICON, `An error occurred. ${this._error}`, true);
        }
        else if (this._improvCurrentState === ImprovCurrentState.AUTHORIZATION_REQUIRED) {
            content = this._renderMessage(AUTHORIZE_ICON, "Press the authorize button on the device", false);
        }
        else if (this._improvCurrentState === ImprovCurrentState.AUTHORIZED) {
            if (this._busy) {
                content = this._renderProgress("Provisioning");
                hideActions = true;
            }
            else {
                heading = "Configure Wi-Fi";
                content = this._renderImprovAuthorized();
            }
        }
        else if (this._improvCurrentState === ImprovCurrentState.PROVISIONING) {
            content = this._renderProgress("Provisioning");
            hideActions = true;
        }
        else if (this._improvCurrentState === ImprovCurrentState.PROVISIONED) {
            content = this._renderImprovProvisioned();
        }
        else {
            content = this._renderMessage(ERROR_ICON, `Unexpected state: ${this._state} - ${this._improvCurrentState}`, true);
        }
        return html `
      <mwc-dialog
        open
        .heading=${heading}
        scrimClickAction
        @closed=${this._handleClose}
        .hideActions=${hideActions}
        >${content}</mwc-dialog
      >
    `;
    }
    _renderProgress(label) {
        return html `
      <div class="center">
        <div>
          <mwc-circular-progress
            active
            indeterminate
            density="8"
          ></mwc-circular-progress>
        </div>
        ${label}
      </div>
    `;
    }
    _renderMessage(icon, label, showClose) {
        return html `
      <div class="center">
        <div class="icon">${icon}</div>
        ${label}
      </div>
      ${showClose &&
            html `
        <mwc-button
          slot="primaryAction"
          dialogAction="ok"
          label="Close"
        ></mwc-button>
      `}
    `;
    }
    _renderImprovAuthorized() {
        let error;
        switch (this._improvErrorState) {
            case 3 /* ImprovErrorState.UNABLE_TO_CONNECT */:
                error = "Unable to connect";
                break;
            case 0 /* ImprovErrorState.NO_ERROR */:
                break;
            default:
                error = `Unknown error (${this._improvErrorState})`;
        }
        return html `
      <div>
        Enter the Wi-Fi credentials of the network that you want
        ${this.device.name || "your device"} to connect to.
        ${hasIdentifyCapability(this._improvCapabilities)
            ? html `
              <button class="link" @click=${this._rpcIdentify}>
                Identify the device.
              </button>
            `
            : ""}
      </div>
      ${error ? html `<p class="error">${error}</p>` : ""}
      <mwc-textfield label="Wi-Fi SSID" name="ssid"></mwc-textfield>
      <mwc-textfield
        label="Wi-Fi password"
        name="password"
        type="password"
      ></mwc-textfield>
      <mwc-button
        slot="primaryAction"
        label="Save"
        @click=${this._rpcWriteSettings}
      ></mwc-button>
      <mwc-button
        slot="secondaryAction"
        dialogAction="close"
        label="Cancel"
      ></mwc-button>
    `;
    }
    _renderImprovProvisioned() {
        let redirectUrl;
        if (this._improvRPCResult &&
            this._improvRPCResult.command === 1 /* ImprovRPCCommand.SEND_WIFI_SETTINGS */ &&
            this._improvRPCResult.values.length > 0) {
            redirectUrl = this._improvRPCResult.values[0];
        }
        return html `
      <div class="center">
        <div class="icon">${OK_ICON}</div>
        Provisioned!
      </div>
      ${redirectUrl === undefined
            ? html `
            <mwc-button
              slot="primaryAction"
              dialogAction="ok"
              label="Close"
            ></mwc-button>
          `
            : html `
            <a
              href=${redirectUrl}
              slot="primaryAction"
              class="has-button"
              dialogAction="ok"
            >
              <mwc-button label="Next"></mwc-button>
            </a>
          `}
    `;
    }
    firstUpdated(changedProps) {
        super.firstUpdated(changedProps);
        this.device.addEventListener("gattserverdisconnected", () => {
            // If we're provisioned, we expect to be disconnected.
            if (this._state === "IMPROV-STATE" &&
                this._improvCurrentState === ImprovCurrentState.PROVISIONED) {
                return;
            }
            this._state = "ERROR";
            this._error = "Device disconnected.";
        });
        this._connect();
    }
    updated(changedProps) {
        super.updated(changedProps);
        if (changedProps.has("_state") ||
            (this._state === "IMPROV-STATE" &&
                changedProps.has("_improvCurrentState"))) {
            const state = this._state === "IMPROV-STATE"
                ? ImprovCurrentState[this._improvCurrentState] || "UNKNOWN"
                : this._state;
            this.stateUpdateCallback({ state });
        }
        if ((changedProps.has("_improvCurrentState") || changedProps.has("_state")) &&
            this._state === "IMPROV-STATE" &&
            this._improvCurrentState === ImprovCurrentState.AUTHORIZED) {
            const input = this._inputSSID;
            input.updateComplete.then(() => input.focus());
        }
    }
    async _connect() {
        // Do everything in sequence as some OSes do not support parallel GATT commands
        // https://github.com/WebBluetoothCG/web-bluetooth/issues/188#issuecomment-255121220
        try {
            await this.device.gatt.connect();
            const service = await this.device.gatt.getPrimaryService(IMPROV_BLE_SERVICE);
            this._currentStateChar = await service.getCharacteristic(IMPROV_BLE_CURRENT_STATE_CHARACTERISTIC);
            this._errorStateChar = await service.getCharacteristic(IMPROV_BLE_ERROR_STATE_CHARACTERISTIC);
            this._rpcCommandChar = await service.getCharacteristic(IMPROV_BLE_RPC_COMMAND_CHARACTERISTIC);
            this._rpcResultChar = await service.getCharacteristic(IMPROV_BLE_RPC_RESULT_CHARACTERISTIC);
            try {
                const capabilitiesChar = await service.getCharacteristic(IMPROV_BLE_RPC_COMMAND_CHARACTERISTIC);
                const capabilitiesValue = await capabilitiesChar.readValue();
                this._improvCapabilities = capabilitiesValue.getUint8(0);
            }
            catch (err) {
                console.warn("Firmware not according to spec, missing capability support.");
            }
            this._currentStateChar.startNotifications();
            this._currentStateChar.addEventListener("characteristicvaluechanged", (ev) => this._handleImprovCurrentStateChange(ev.target.value));
            this._errorStateChar.startNotifications();
            this._errorStateChar.addEventListener("characteristicvaluechanged", (ev) => this._handleImprovErrorStateChange(ev.target.value));
            this._rpcResultChar.startNotifications();
            this._rpcResultChar.addEventListener("characteristicvaluechanged", (ev) => this._handleImprovRPCResultChange(ev.target.value));
            const curState = await this._currentStateChar.readValue();
            const errorState = await this._errorStateChar.readValue();
            this._handleImprovCurrentStateChange(curState);
            this._handleImprovErrorStateChange(errorState);
            this._state = "IMPROV-STATE";
        }
        catch (err) {
            this._state = "ERROR";
            this._error = `Unable to establish a connection: ${err}`;
        }
    }
    _handleImprovCurrentStateChange(encodedState) {
        const state = encodedState.getUint8(0);
        if (DEBUG)
            console.log("improv current state", state);
        this._improvCurrentState = state;
        // If we receive a new state, it means the RPC command is done
        this._busy = false;
    }
    _handleImprovErrorStateChange(encodedState) {
        const state = encodedState.getUint8(0);
        if (DEBUG)
            console.log("improv error state", state);
        this._improvErrorState = state;
        // Sending an RPC command sets error to no error.
        // If we get a real error it means the RPC command is done.
        if (state !== 0 /* ImprovErrorState.NO_ERROR */) {
            this._busy = false;
            if (this._rpcFeedback) {
                this._rpcFeedback.reject(state);
                this._rpcFeedback = undefined;
            }
        }
    }
    _handleImprovRPCResultChange(encodedResult) {
        if (DEBUG)
            console.log("improv RPC result", encodedResult);
        const command = encodedResult.getUint8(0);
        const result = {
            command,
            values: [],
        };
        const dataLength = encodedResult.getUint8(1);
        const baseOffset = 2;
        const decoder = new TextDecoder();
        for (let start = 0; start < dataLength;) {
            const valueLength = encodedResult.getUint8(baseOffset + start);
            const valueBytes = new Uint8Array(valueLength);
            const valueOffset = baseOffset + start + 1;
            for (let i = 0; i < valueLength; i++) {
                valueBytes[i] = encodedResult.getUint8(valueOffset + i);
            }
            result.values.push(decoder.decode(valueBytes));
            start += valueLength;
        }
        this._improvRPCResult = result;
        if (this._rpcFeedback) {
            this._rpcFeedback.resolve(result);
            this._rpcFeedback = undefined;
        }
    }
    _rpcIdentify() {
        this._sendRPC(2 /* ImprovRPCCommand.IDENTIFY */, new Uint8Array(), false);
    }
    async _rpcWriteSettings() {
        const encoder = new TextEncoder();
        const ssidEncoded = encoder.encode(this._inputSSID.value);
        const pwEncoded = encoder.encode(this._inputPassword.value);
        const data = new Uint8Array([
            ssidEncoded.length,
            ...ssidEncoded,
            pwEncoded.length,
            ...pwEncoded,
        ]);
        try {
            await this._sendRPC(1 /* ImprovRPCCommand.SEND_WIFI_SETTINGS */, data, true);
            if (DEBUG)
                console.log("Provisioned! Disconnecting gatt");
            // We're going to set this result manually in case we get RPC result first
            // that way it's safe to disconnect.
            this._improvCurrentState = ImprovCurrentState.PROVISIONED;
            this.device.gatt.disconnect();
        }
        catch (err) {
            // Do nothing. Error code will handle itself.
        }
    }
    async _sendRPC(command, data, 
    // If set to true, the promise will return the RPC result.
    requiresFeedback) {
        if (DEBUG)
            console.log("RPC COMMAND", command, data);
        // Commands that receive feedback will finish when either
        // the state changes or the error code becomes not 0.
        if (requiresFeedback) {
            if (this._rpcFeedback) {
                throw new Error("Only 1 RPC command that requires feedback can be active");
            }
            this._busy = true;
        }
        const payload = new Uint8Array([command, data.length, ...data, 0]);
        payload[payload.length - 1] = payload.reduce((sum, cur) => sum + cur, 0);
        this._improvRPCResult = undefined;
        if (requiresFeedback) {
            return await new Promise((resolve, reject) => {
                this._rpcFeedback = { resolve, reject };
                this._rpcCommandChar.writeValueWithoutResponse(payload);
            });
        }
        else {
            this._rpcCommandChar.writeValueWithoutResponse(payload);
            return undefined;
        }
    }
    async _handleClose() {
        if (this.device.gatt.connected) {
            if (DEBUG)
                console.log("Disconnecting gatt");
            this.device.gatt.disconnect();
        }
        this.parentNode.removeChild(this);
    }
};
ProvisionDialog.styles = css `
    :host {
      --mdc-dialog-max-width: 390px;
      --mdc-theme-primary: var(--improv-primary-color, #03a9f4);
      --mdc-theme-on-primary: var(--improv-on-primary-color, #fff);
    }
    mwc-textfield {
      display: block;
    }
    mwc-textfield {
      margin-top: 16px;
    }
    .center {
      text-align: center;
    }
    mwc-circular-progress {
      margin-bottom: 16px;
    }
    a.has-button {
      text-decoration: none;
    }
    .icon {
      font-size: 50px;
      line-height: 80px;
      color: black;
    }
    .error {
      color: #db4437;
    }
    button.link {
      background: none;
      color: inherit;
      border: none;
      padding: 0;
      font: inherit;
      text-align: left;
      text-decoration: underline;
      cursor: pointer;
    }
  `;
__decorate([
    state()
], ProvisionDialog.prototype, "_state", void 0);
__decorate([
    state()
], ProvisionDialog.prototype, "_improvCurrentState", void 0);
__decorate([
    state()
], ProvisionDialog.prototype, "_improvErrorState", void 0);
__decorate([
    state()
], ProvisionDialog.prototype, "_improvRPCResult", void 0);
__decorate([
    state()
], ProvisionDialog.prototype, "_improvCapabilities", void 0);
__decorate([
    state()
], ProvisionDialog.prototype, "_busy", void 0);
__decorate([
    query("mwc-textfield[name=ssid]")
], ProvisionDialog.prototype, "_inputSSID", void 0);
__decorate([
    query("mwc-textfield[name=password]")
], ProvisionDialog.prototype, "_inputPassword", void 0);
ProvisionDialog = __decorate([
    customElement("improv-wifi-provision-dialog")
], ProvisionDialog);
