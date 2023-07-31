import { DataCaptureView } from 'scandit-react-native-datacapture-core'
import useScan from './useScan'
import { Text } from 'react-native'

function App(): JSX.Element {
    const { viewRef, dataCaptureContext, result, reset } = useScan()
    return (
        // @ts-ignore - typesafe
        <DataCaptureView
            style={{ flex: 1, padding: 16 }}
            context={dataCaptureContext}
            ref={viewRef}
        >
            {result && <Text>{JSON.stringify(result)}</Text>}
        </DataCaptureView>
    )
}

export default App
