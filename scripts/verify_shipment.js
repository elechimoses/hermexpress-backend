import { query, pool } from '../src/db/index.js';
import { getAdminRecentShipments, updateShipmentStatus, getShipmentDetails } from '../src/controllers/shipment.controller.js';

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const runVerification = async () => {
    try {
        console.log('Starting Verification...');

        // 1. Create a dummy shipment
        const tracking = 'TEST-' + Date.now();
        const shipmentRes = await query(
            `INSERT INTO shipments (tracking_number, status, total_price) VALUES ($1, 'pending', 1000) RETURNING id`,
            [tracking]
        );
        const shipmentId = shipmentRes.rows[0].id;
        console.log(`Created test shipment: ${shipmentId}`);

        // Add dummy addresses
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

        // 2. Test getAdminRecentShipments
        console.log('\nTesting getAdminRecentShipments...');
        const req1 = {};
        const res1 = mockRes();
        await getAdminRecentShipments(req1, res1);
        
        const recent = res1.data.data;
        const found = recent.find(s => s.id === shipmentId);
        if (found) {
            console.log('Found recent shipment:', found);
            if (found.origin.includes('Lagos') && found.destination.includes('New York')) {
                console.log('SUCCESS: Origin and Destination correct.');
            } else {
                console.error('FAILURE: Origin/Destination missing or incorrect.');
            }
        } else {
            console.error('FAILURE: Shipment not found in recent list.');
        }

        // 3. Test updateShipmentStatus
        console.log('\nTesting updateShipmentStatus...');
        const req2 = { params: { id: shipmentId }, body: { status: 'in_transit', description: 'Moved to hub' } };
        const res2 = mockRes();
        await updateShipmentStatus(req2, res2);
        
        if (res2.statusCode === 200 || res2.statusCode === 201) {
             console.log('Update Status Response:', res2.statusCode, res2.data.message);
        } else {
             console.error('FAILURE: Update Status failed', res2.data);
        }

        // 4. Test getShipmentDetails and history
        console.log('\nTesting getShipmentDetails...');
        const req3 = { params: { id: shipmentId } };
        const res3 = mockRes();
        await getShipmentDetails(req3, res3);
        
        const details = res3.data.data;
        console.log('Details retrieved.');
        if (details.status === 'in_transit') {
            console.log('SUCCESS: Shipment status updated in details.');
        } else {
            console.error(`FAILURE: Status is ${details.status}, expected in_transit`);
        }

        if (details.statusHistory && details.statusHistory.length > 0) {
            console.log('SUCCESS: History retrieved:', details.statusHistory[0]);
        } else {
             console.error('FAILURE: No history found.');
        }

        // Cleanup
        await query('DELETE FROM shipments WHERE id = $1', [shipmentId]);
        console.log('\nCleanup done.');

    } catch (err) {
        console.error('Verification Error:', err);
    } finally {
        // pool.end() might hang if connection is kept open by app, but here it's fine
        process.exit(0);
    }
};

runVerification();
