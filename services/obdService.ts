// FIX: Define type for Web Bluetooth API to resolve TypeScript error.
type BluetoothRemoteGATTCharacteristic = any;

// These UUIDs are common for many ELM327-based Bluetooth OBD-II scanners.
const OBD_SERVICE_UUIDS = [
    '00001101-0000-1000-8000-00805f9b34fb', // Standard Serial Port Service
    '0000ffe0-0000-1000-8000-00805f9b34fb'  // Common for clones
];
const OBD_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

const encoder = new TextEncoder();

/**
 * Scans for and connects to a Bluetooth OBD-II device.
 */
export const connectToOBD = async () => {
    try {
        // FIX: Property 'bluetooth' does not exist on type 'Navigator'.
        if (!(navigator as any).bluetooth) {
            throw new Error('Bluetooth: Web Bluetooth API is not available in this browser.');
        }

        // FIX: Property 'bluetooth' does not exist on type 'Navigator'.
        const device = await (navigator as any).bluetooth.requestDevice({
            filters: [{ services: OBD_SERVICE_UUIDS }],
            optionalServices: OBD_SERVICE_UUIDS
        });

        if (!device.gatt) {
             throw new Error('Bluetooth: GATT server not available on this device.');
        }

        const server = await device.gatt.connect();
        
        // Use the first available service UUID that the device offers
        const serviceUuid = OBD_SERVICE_UUIDS.find(uuid => server.services.some(s => s.uuid === uuid));
        if (!serviceUuid) {
            const primaryServices = await server.getPrimaryServices();
            if (primaryServices.length > 0) {
                 const service = primaryServices[0];
                 const characteristics = await service.getCharacteristics();
                 if (characteristics.length >= 2) {
                     return { device, tx: characteristics[1], rx: characteristics[0] };
                 }
            }
            throw new Error('OBD-II: Could not find a compatible service on the device.');
        }

        const service = await server.getPrimaryService(serviceUuid);
        const characteristic = await service.getCharacteristic(OBD_CHARACTERISTIC_UUID);

        // Many cheap devices use the same characteristic for both reading (notify) and writing.
        return { device, tx: characteristic, rx: characteristic };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
            throw new Error('Bluetooth: No compatible OBD-II device found. Please ensure it is powered on and in range.');
        }
        throw error;
    }
};

/**
 * Sends a command to the OBD-II device.
 * @param txCharacteristic The characteristic to write to.
 * @param command The command string (e.g., '03' for DTCs).
 */
export const sendCommand = async (txCharacteristic: BluetoothRemoteGATTCharacteristic, command: string) => {
    const commandBytes = encoder.encode(command + '\r');
    await txCharacteristic.writeValue(commandBytes);
};

/**
 * Parses a raw string response from an OBD-II device to extract Diagnostic Trouble Codes (DTCs).
 * @param data The raw string data from the device.
 * @returns An array of formatted DTC strings (e.g., ['P0123', 'C0456']).
 */
export const parseDTCs = (data: string): string[] => {
    const codes: string[] = [];
    // Clean up response, remove spaces, prompts, and null characters
    const cleanedData = data.replace(/\s/g, '').replace(/>/g, '').replace(/\0/g, '').trim();

    // Find lines that start with '43', which is the response for Mode 03 (DTCs)
    const responseLines = cleanedData.match(/43[0-9A-F]*/gi) || [];

    for (const line of responseLines) {
        // Each code is 4 hex characters (2 bytes)
        // The format is 43 (mode) + NN (number of codes) + AABB (code 1) + CCDD (code 2) ...
        const dtcData = line.substring(2); // Remove the '43' prefix

        for (let i = 0; i < dtcData.length; i += 4) {
            const codeBytes = dtcData.substring(i, i + 4);
            if (codeBytes.length !== 4 || codeBytes === '0000') continue;

            const firstCharVal = parseInt(codeBytes.charAt(0), 16);
            let firstLetter = '';
            
            // First two bits of the first hex character determine the code type
            switch (firstCharVal >> 2) {
                case 0: firstLetter = 'P'; break; // Powertrain
                case 1: firstLetter = 'C'; break; // Chassis
                case 2: firstLetter = 'B'; break; // Body
                case 3: firstLetter = 'U'; break; // Network
            }

            const restOfCode = (firstCharVal % 4).toString(16) + codeBytes.substring(1);
            const formattedCode = firstLetter + restOfCode.toUpperCase().padStart(4, '0');
            
            if (!codes.includes(formattedCode)) {
                 codes.push(formattedCode);
            }
        }
    }

    return codes;
};
