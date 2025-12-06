import { withAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { sanitizeDisplayName, validateEmail, sanitizeText } from '@/lib/sanitization';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, display_name, email, google_id } = body;

        // Validate required field
        if (!id || typeof id !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Valid user ID is required' },
                { status: 400 }
            );
        }

        // Sanitize ID (remove any potential injection attempts)
        const sanitizedId = sanitizeText(id).slice(0, 255);

        if (!sanitizedId) {
            return NextResponse.json(
                { success: false, error: 'Invalid user ID' },
                { status: 400 }
            );
        }

        // Sanitize and validate display name if provided
        let sanitizedDisplayName = null;
        if (display_name) {
            const nameValidation = sanitizeDisplayName(display_name);
            if (nameValidation.valid) {
                sanitizedDisplayName = nameValidation.sanitized;
            }
        }

        // Validate email if provided
        let sanitizedEmail = null;
        if (email) {
            const emailValidation = validateEmail(email);
            if (emailValidation.valid) {
                sanitizedEmail = sanitizeText(email).slice(0, 255);
            }
        }

        // Sanitize google_id if provided
        let sanitizedGoogleId = null;
        if (google_id) {
            sanitizedGoogleId = sanitizeText(google_id).slice(0, 255);
        }

        const result = await withAdmin(async (supabase) => {
            const { error } = await supabase
                .from('users')
                .upsert({
                    id: sanitizedId,
                    display_name: sanitizedDisplayName,
                    email: sanitizedEmail,
                    google_id: sanitizedGoogleId,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'id'
                });

            if (error) {
                console.error('Error syncing user to Supabase:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Unexpected error syncing user:', error);
        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}