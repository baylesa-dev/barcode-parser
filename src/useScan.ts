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
    ai?: string | null
    exp?: string | null
    batch?: string | null
    symbology: string
}

function extractInfoFromGTIN(gtin: string): {
    ai: string
    batch?: string
    exp?: string
} {
    const aiMatch = gtin.match(/(?:\()?01(?:\))?(\d{13,14})/)
    const batchMatch = gtin.match(/(?:\()?10(?:\))?(.+)/)
    const expMatch = gtin.match(/(?:\()?17(?:\))?(\d+)/)

    const ai = aiMatch ? aiMatch[1] : ''
    const batch = batchMatch ? batchMatch[1] : undefined
    const exp = expMatch ? expMatch[1] : undefined

    return { ai, batch, exp }
}

export default function useScan() {
    const viewRef = useRef<DataCaptureView>(null)
    const dataCaptureContext = useMemo(() => DataCaptureContext.forLicenseKey(LICENSE_KEY), [])
    const [camera, setCamera] = useState<Camera | null>(Camera.default)

    const [barcodeSelection, setBarcodeSelection] = useState<BarcodeSelection | null>(null)
    const [cameraState, setCameraState] = useState(FrameSourceState.Off)
    const lastCommand = useRef<string | null>(null)

    const [result, setResult] = useState<Result | null>(null)

    useEffect(() => {
        const handleAppStateChangeSubscription = AppState.addEventListener(
            'change',
            handleAppStateChange
        )

        setupScanning()
        setupParser()
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

    const parser = useRef<Parser | null>()
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

        const barcodeSelection = BarcodeSelection.forContext(dataCaptureContext, selectionSettings)
        barcodeSelection.addListener({
            didUpdateSelection: (_, session) => {
                const barcode = session.newlySelectedBarcodes[0]
                if (barcode) {
                    const symbology = new SymbologyDescription(barcode.symbology)

                    const matched = extractInfoFromGTIN(barcode.data ?? '')

                    if (barcode.data && parser.current) {
                        parser.current.parseString(barcode.data).then(result => {
                            // fails here
                            console.log(result)
                        })
                    }

                    setResult({
                        rawData: barcode.data ?? '',
                        ...(matched ?? {}),
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

    const setupParser = () => {
        Parser.forContextAndFormat(dataCaptureContext, ParserDataFormat.GS1AI).then(
            value => (parser.current = value)
        )
    }

    const startCamera = useCallback(() => {
        setCameraState(FrameSourceState.On)
    }, [])

    const stopCamera = useCallback(() => {
        if (camera) setCameraState(FrameSourceState.Off)
    }, [camera])

    const startCapture = useCallback(() => {
        if (lastCommand.current === 'startCapture') {
            return
        }
        lastCommand.current = 'startCapture'
        startCamera()
        if (barcodeSelection) barcodeSelection.isEnabled = true
    }, [startCamera])

    const stopCapture = useCallback(() => {
        if (lastCommand.current === 'stopCapture') {
            return
        }
        lastCommand.current = 'stopCapture'
        if (barcodeSelection) barcodeSelection.isEnabled = false
        stopCamera()
    }, [stopCamera])

    const handleAppStateChange = useCallback(
        (appState: AppStateStatus) => {
            if (appState.match(/inactive|background/)) stopCapture()
            else startCapture()
        },
        [startCapture, stopCapture]
    )

    const reset = useCallback(() => {
        setResult(null)
        if (barcodeSelection) barcodeSelection.isEnabled = true
    }, [])

    return { viewRef, dataCaptureContext, result, reset }
}
