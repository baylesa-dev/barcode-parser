import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppStateStatus, AppState } from 'react-native'

import {
    BarcodeCaptureSettings,
    BarcodeSelection,
    BarcodeSelectionBasicOverlay,
    BarcodeSelectionBasicOverlayStyle,
    BarcodeSelectionSettings,
    Symbology,
    SymbologyDescription
} from 'scandit-react-native-datacapture-barcode'
import {
    Camera,
    DataCaptureContext,
    DataCaptureView,
    FrameSourceState
} from 'scandit-react-native-datacapture-core'
import { Parser, ParserDataFormat } from 'scandit-react-native-datacapture-parser'

const LICENSE_KEY = '//'

export type Result = {
    rawData: string
    symbology: string
}

export default function useScan() {
    const viewRef = useRef<DataCaptureView>(null)
    const dataCaptureContext = useMemo(() => DataCaptureContext.forLicenseKey(LICENSE_KEY), [])
    const [camera, setCamera] = useState<Camera | null>(Camera.default)
    const [parser, setParser] = useState<Parser | null>(null)
    const [barcodeSelection, setBarcodeSelection] = useState<BarcodeSelection | null>(null)
    const [cameraState, setCameraState] = useState(FrameSourceState.Off)

    const [result, setResult] = useState<Result | null>(null)

    useEffect(() => {
        const handleAppStateChangeSubscription = AppState.addEventListener(
            'change',
            handleAppStateChange
        )

        setupScanning()
        startCapture()

        return () => {
            handleAppStateChangeSubscription.remove()
            stopCapture()
            dataCaptureContext.dispose()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (camera) camera.switchToDesiredState(cameraState)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cameraState])

    const setupScanning = () => {
        camera?.applySettings(BarcodeSelection.recommendedCameraSettings)

        dataCaptureContext.setFrameSource(camera)
        setCamera(camera)

        const settings = new BarcodeCaptureSettings()
        settings.enableSymbologies([
            Symbology.EAN13UPCA,
            Symbology.EAN8,
            Symbology.UPCE,
            Symbology.QR,
            Symbology.DataMatrix,
            Symbology.Code39,
            Symbology.Code128
        ])

        const selectionSettings = new BarcodeSelectionSettings()
        selectionSettings.enableSymbologies([Symbology.DataMatrix, Symbology.Code128])

        Parser.forContextAndFormat(dataCaptureContext, ParserDataFormat.GS1AI).then(_parser => {
            setParser(_parser)
        })

        const barcodeSelection = BarcodeSelection.forContext(dataCaptureContext, selectionSettings)
        barcodeSelection.addListener({
            didUpdateSelection: (_, session) => {
                const barcode = session.newlySelectedBarcodes[0]
                if (barcode) {
                    const symbology = new SymbologyDescription(barcode.symbology)


                    if (barcode.data && parser) {
                        parser.parseString(barcode.data).then(result => {
                            // fails here
                            console.log(result)
                        })
                    }

                    setResult({
                        rawData: barcode.data ?? '',
                        symbology: symbology.identifier
                    })
                } else {
                    setResult(null)
                }
            }
        })

        const overlay = BarcodeSelectionBasicOverlay.withBarcodeSelectionForViewWithStyle(
            barcodeSelection,
            viewRef.current,
            BarcodeSelectionBasicOverlayStyle.Dot
        )

        overlay.shouldShowHints = false
        viewRef.current?.addOverlay(overlay)
        setBarcodeSelection(barcodeSelection)
    }

    const startCamera = () => {
        setCameraState(FrameSourceState.On)
    }

    const stopCamera = () => {
        if (camera) setCameraState(FrameSourceState.Off)
    }

    const startCapture = () => {
        startCamera()
        if (barcodeSelection) barcodeSelection.isEnabled = true
    }

    const stopCapture = () => {
        if (barcodeSelection) barcodeSelection.isEnabled = false
        stopCamera()
    }

    const handleAppStateChange = (appState: AppStateStatus) => {
        if (appState.match(/inactive|background/)) stopCapture()
        else startCapture()
    }

    const reset = useCallback(() => {
        setResult(null)
        if (barcodeSelection) barcodeSelection.isEnabled = true
    }, [])

    return { viewRef, dataCaptureContext, result, reset }
}
