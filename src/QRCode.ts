import { Observable, o, ComputedObservable } from "@alumis/observables";
import { Component, IAttributes, createNode, bindAttribute, blockAnimator, appendDispose } from "@alumis/observables-dom";
import { r } from "@alumis/observables-i18n";
import { CancellationToken } from "@alumis/utils/src/CancellationToken";
import qrcode from "qrcode";
import { OperationCancelledError } from "@alumis/utils/src/OperationCancelledError";
import { loadImageUrlAsync } from "@alumis/utils/src/loadImageUrlAsync";

export class QRCode extends Component<HTMLDivElement> {

    constructor(attrs: IQRCodeAttributes) {

        super();

        if (attrs) {

            var value = attrs.value;

            this._size = attrs.size;
            this._errorCorrectionLevel = attrs.errorCorrectionLevel;

            delete attrs.value;
            delete attrs.size;
            delete attrs.errorCorrectionLevel;
        }

        (this.node = <HTMLDivElement>createNode("div", attrs, this._imageElementObservable)).setAttribute("role", "img");
        bindAttribute(this.node, "aria-label", r("qrCode"));

        /// <i18n key="qrCode" lang="en">QR Code</i18n>
        /// <i18n key="qrCode" lang="no">QR-kode</i18n>

        if (value instanceof Observable) {

            appendDispose(this.node, value.subscribeInvoke(this.valueAction).dispose);
            this.valueAsObservable = value;
        }

        else if (typeof value === "function") {

            let computedObservable = ComputedObservable.createComputed(value);

            computedObservable.subscribeInvoke(this.valueAction);
            appendDispose(this.node, computedObservable.dispose);

            this.valueAsObservable = computedObservable;
        }

        else {

            let observable = Observable.create(value);

            observable.subscribeInvoke(this.valueAction);
            appendDispose(this.node, observable.dispose);

            this.valueAsObservable = observable;
        }

        appendDispose(this.node, () => {

            if (this._cancellationToken)
                this._cancellationToken.cancel();

            this._imageElementObservable.dispose();
        });
    }

    valueAsObservable: Observable<string>;

    private _size: number;
    private _errorCorrectionLevel: QRCodeErrorCorrectionLevel;

    private _imageElementObservable = o(undefined as HTMLDivElement);
    private _cancellationToken: CancellationToken;

    valueAction = (newValue) => {

        if (this._cancellationToken) {

            this._cancellationToken.cancel();
            delete this._cancellationToken;
        }

        this._cancellationToken = new CancellationToken();

        (async () => {

            try {

                this._imageElementObservable.value = await createQrCodeImageElementAsync(newValue, this._size, this._errorCorrectionLevel, this._cancellationToken);
            }

            catch (e) {

                if (!(e instanceof OperationCancelledError))
                    throw e;
            }

            delete this._cancellationToken;

        })();
    };
}

function createQrCodeImageElementAsync(value: string, size: number, errorCorrectionLevel: QRCodeErrorCorrectionLevel, cancellationToken: CancellationToken): Promise<HTMLDivElement> {

    return new Promise((resolve, reject) => {

        if (value) {

            qrcode.toDataURL(value, { errorCorrectionLevel: errorCorrectionLevel, width: size, margin: 0 }, async (error, url) => {

                if (cancellationToken.isCancellationRequested)
                    reject(new OperationCancelledError());

                else if (error)
                    reject(error);

                else {

                    let img = createNode("img", { animator: blockAnimator }) as HTMLImageElement;

                    try {

                        await loadImageUrlAsync(img, url);
                    }

                    catch (e) {
                        
                        reject(cancellationToken.isCancellationRequested ? new OperationCancelledError() : e);
                        return;
                    }

                    if (cancellationToken.isCancellationRequested)
                        reject(new OperationCancelledError());
                    
                    else {

                        let div = document.createElement("div");

                        div.appendChild(img);
                        resolve(div);
                    }
                }
            });
        }

        else resolve(null);
    });
}

export interface IQRCodeAttributes extends IAttributes {

    value?: string | Observable<string> | (() => string);
    size?: number;
    errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
}

export enum QRCodeErrorCorrectionLevel {

    Low = "low",
    Medium = "medium",
    Quartile = "quartile",
    High = "high"
}