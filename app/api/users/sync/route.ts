import { withAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { id, display_name, email, google_id } = await req.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        const result = await withAdmin(async (supabase) => {
            const { error } = await supabase
                .from('users')
                .upsert({
                    id,
                    display_name,
                    email,
                    google_id,
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
            { success: false, error: error.message || 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}