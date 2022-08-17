/// <reference types="web-bluetooth" />
import { LitElement, PropertyValues, TemplateResult } from "lit";
import "@material/mwc-dialog";
import "@material/mwc-textfield";
import "@material/mwc-button";
import "@material/mwc-circular-progress";
import { ImprovState } from "./const";
declare class ProvisionDialog extends LitElement {
    device: BluetoothDevice;
    stateUpdateCallback: (state: ImprovState) => void;
    private _state;
    private _improvCurrentState?;
    private _improvErrorState;
    private _improvRPCResult?;
    private _improvCapabilities;
    private _busy;
    private _error?;
    private _currentStateChar?;
    private _errorStateChar?;
    private _rpcCommandChar?;
    private _rpcResultChar?;
    private _rpcFeedback?;
    private _inputSSID;
    private _inputPassword;
    protected render(): TemplateResult<1>;
    _renderProgress(label: string): TemplateResult<1>;
    _renderMessage(icon: string, label: string, showClose: boolean): TemplateResult<1>;
    private _renderImprovAuthorized;
    private _renderImprovProvisioned;
    protected firstUpdated(changedProps: PropertyValues): void;
    protected updated(changedProps: PropertyValues): void;
    private _connect;
    private _handleImprovCurrentStateChange;
    private _handleImprovErrorStateChange;
    private _handleImprovRPCResultChange;
    private _rpcIdentify;
    private _rpcWriteSettings;
    private _sendRPC;
    private _handleClose;
    static styles: import("lit").CSSResult;
}
declare global {
    interface HTMLElementTagNameMap {
        "improv-wifi-provision-dialog": ProvisionDialog;
    }
}
export {};
