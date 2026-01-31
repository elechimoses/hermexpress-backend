import fs from 'fs';
import { query, pool } from '../src/db/index.js';

const logFile = 'verification_result.log';
// clear log
fs.writeFileSync(logFile, 'Starting verification...\n');

const log = (...args) => {
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, Object.getOwnPropertyNames(a)))).join(' ');
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
};

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
};

const run = async () => {
    try {
        log('Importing controller...');
        const controller = await import('../src/controllers/shipment.controller.js');
        log('Controller imported.');
        const { getAdminRecentShipments, updateShipmentStatus, getShipmentDetails } = controller;

        // 1. Create a dummy shipment
        const tracking = 'TEST-' + Date.now();
        log(`Creating shipment with tracking ${tracking}`);
        const shipmentRes = await query(
            `INSERT INTO shipments (tracking_number, status, total_price) VALUES ($1, 'pending', 1000) RETURNING id`,
            [tracking]
        );
        const shipmentId = shipmentRes.rows[0].id;
        log(`Created test shipment: ${shipmentId}`);
        
        // Addresses
        await query(
            `INSERT INTO shipment_addresses (shipment_id, type, name, country, city, address, phone, state) 
             VALUES ($1, 'sender', 'Sender Name', 'Nigeria', 'Lagos', '123 St', '0800', 'LA')`,
            [shipmentId]
        );
        await query(
            `INSERT INTO shipment_addresses (shipment_id, type, name, country, city, address, phone, state) 
             VALUES ($1, 'receiver', 'Receiver Name', 'USA', 'New York', '456 Av', '0900', 'NY')`,
            [shipmentId]
        );

        // Test getAdminRecentShipments
        log('Testing getAdminRecentShipments...');
        const req1 = {};
        const res1 = mockRes();
        await getAdminRecentShipments(req1, res1);
        const recent = res1.data.payload;
        const found = recent.find(s => s.id === shipmentId);
        
        if (found) {
            log('Found shipment in recent list.');
            if (found.origin.includes('Lagos') && found.destination.includes('New York')) {
                 log('SUCCESS: Origin/Dest correct');
            } else {
                 log('FAILURE: Origin/Dest wrong: ' + JSON.stringify(found));
            }
        } else {
            log('FAILURE: Not found in recent list');
        }

        // Test update
        log('Testing updateShipmentStatus...');
        const req2 = { params: { id: shipmentId }, body: { status: 'in_transit' } };
        const res2 = mockRes();
        await updateShipmentStatus(req2, res2);
        log(`Update status code: ${res2.statusCode}`);

        // Test details
        log('Testing getShipmentDetails...');
        const req3 = { params: { id: shipmentId } };
        const res3 = mockRes();
        await getShipmentDetails(req3, res3);
        const details = res3.data.payload;
        
        if (details.status === 'in_transit') {
            log('SUCCESS: Details status updated');
        } else {
             log('FAILURE: Status mismatch: ' + details.status);
        }
        
        if (details.statusHistory && details.statusHistory.length > 0) {
            log('SUCCESS: History found');
        } else {
            log('FAILURE: No history found');
        }

        // Test trackShipment (User/Public tracking)
        log('Testing trackShipment...');
        const controller2 = await import('../src/controllers/shipment.controller.js');
        const { trackShipment } = controller2;
        const req4 = { params: { trackingNumber: tracking } };
        const res4 = mockRes();
        await trackShipment(req4, res4);
        
        if (res4.data.payload && res4.data.payload.trackingNumber === tracking) {
             log('SUCCESS: Track shipment returned correct data');
             if (res4.data.payload.history.length > 0) {
                 log('SUCCESS: Track shipment returned history');
             } else {
                 log('FAILURE: Track shipment history empty');
             }
        } else {
             log('FAILURE: Track shipment failed: ' + JSON.stringify(res4.data));
        }

        // cleanup
        await query('DELETE FROM shipments WHERE id = $1', [shipmentId]);
        log('Cleanup done.');

    } catch (err) {
        log('Error:', err);
    } finally {
        process.exit(0);
    }
};

run();
