import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const APP_URL = process.env.APP_URL;
const KORAPAY_BASE_URL = process.env.KORAPAY_BASE_URL;
const PAYSTACK_PAYMENT_URL = process.env.PAYSTACK_PAYMENT_URL;

export const initializePayment = async (data) => {
    const { 
        provider, 
        config, // contains keys like publicKey/secretKey
        amount, 
        email, 
        name, 
        trackingNumber, 
        shipmentId 
    } = data;

    if (!provider) throw new Error('Payment provider is required');

    // 1. Paystack
    if (provider === 'paystack') {
        const secretKey = config.secretKey || process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) throw new Error('Paystack Secret Key not configured');

        const reference = `${trackingNumber}_${uuidv4().slice(0, 5)}`;

        const payload = {
            email: email || 'customer@example.com',
            amount: Math.round(amount * 100), // kobo
            reference: reference,
            callback_url: `${APP_URL}/api/payment/callback/paystack`,
            metadata: {
                tracking_number: trackingNumber,
                shipment_id: shipmentId,
                payment_method: 'paystack',
                ...data.metadata // Merge extra metadata (e.g. wallet_funding)
            },
        };

        const response = await axios.post(
            `${PAYSTACK_PAYMENT_URL}/transaction/initialize`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            }
        );

        if (!response.data?.status || !response.data?.data?.authorization_url) {
            throw new Error('Paystack initialization failed');
        }

        return {
            success: true,
            provider: 'paystack',
            paymentUrl: response.data.data.authorization_url,
            reference: response.data.data.reference,
            trackingNumber
        };
    }

    // 2. Korapay
    else if (provider === 'korapay') {
        const secretKey = config.secretKey || process.env.KORAPAY_SECRET_KEY;
        if (!secretKey) throw new Error('Korapay Secret Key not configured');
        
        const reference = `${trackingNumber}_${uuidv4().slice(0, 5)}`; // Unique ref if retrying

        const payload = {
            amount: Math.round(amount), // Naira provided directly
            currency: 'NGN',
            reference: reference, // Kora needs unique
            redirect_url: `${APP_URL}/api/payment/callback/korapay`,
            notification_url: `${APP_URL}/api/webhooks/korapay`,
            narration: `Shipment #${trackingNumber}`,
            customer: {
                name: name || 'Customer',
                email: email || 'customer@example.com',
            },
            metadata: {
                tracking_number: trackingNumber,
                shipment_id: shipmentId,
                ...data.metadata
            },
            merchant_bears_cost: false,
        };

        console.log(payload);

        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await axios.post(
                    `${KORAPAY_BASE_URL}/charges/initialize`,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${secretKey}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 60000,
                    }
                );

                if (response.data?.status && response.data?.data?.checkout_url) {
                    return {
                        success: true,
                        provider: 'korapay',
                        paymentUrl: response.data.data.checkout_url,
                        reference: reference,
                        trackingNumber
                    };
                }
            } catch (err) {
                lastError = err;
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
        throw new Error(`Korapay failed after retries: ${lastError?.message || 'Unknown'}`);
    }

    // 3. Bank Transfer (Manual)
    else if (provider === 'bank_transfer') {
        return {
            success: true,
            provider: 'bank_transfer',
            message: 'Please transfer to the provided bank account.',
            details: config // Return bank details again if needed
        };
    }

    throw new Error(`Unsupported payment provider: ${provider}`);
};

export const verifyPayment = async (provider, reference) => {
    if (!provider || !reference) {
        throw new Error('Provider and reference are required');
    }

    // 1. Paystack Verification
    if (provider === 'paystack') {
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) throw new Error('Paystack Secret Key not configured');

        try {
            const response = await axios.get(
                `${PAYSTACK_PAYMENT_URL}/transaction/verify/${reference}`,
                {
                    headers: {
                        Authorization: `Bearer ${secretKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );

            if (response.data?.status === true && response.data?.data?.status === 'success') {
                return {
                    success: true,
                    data: response.data.data
                };
            }
             // Should return data even if status is not success, to retrieve metadata
            return { 
                success: false, 
                message: 'Paystack status not success',
                data: response.data?.data 
            };
        } catch (error) {
            console.error('Paystack Verify Error:', error.message);
            return { success: false, message: error.message };
        }
    }

    // 2. Korapay Verification
    else if (provider === 'korapay') {
        const secretKey = process.env.KORAPAY_SECRET_KEY;
        const baseUrl = process.env.KORAPAY_BASE_URL;

        if (!secretKey) throw new Error('Korapay Secret Key not configured');

        try {
            const response = await axios.get(`${baseUrl}/charges/${reference}`, {
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            if (response.status === 200 && response.data?.status === true && (response.data?.data?.status === 'success' || response.data?.data?.status === 'successful')) {
                 return {
                    success: true,
                    data: response.data.data
                };
            }
             // Should return data even if status is not success, to retrieve metadata
            return { 
                success: false, 
                message: 'Korapay status not success',
                data: response.data?.data
            };

        } catch (error) {
             console.error('Korapay Verify Error:', error.message);
             return { success: false, message: error.message };
        }
    }

    throw new Error(`Unsupported provider for verification: ${provider}`);
};
