import { ref, computed, watch } from 'vue';
import { supabase } from '../services/supabase';
import type { SubmissionReview } from '../types';
import { runHarvester } from '../services/submissionHarvester';
import { useAuthStore } from '../stores/auth';

export function useSubmissionReviews() {
    // --- State ---
    const reviews = ref<SubmissionReview[]>([]);
    const loading = ref(false);
    const isHarvesting = ref(false);
    const isProcessing = ref(false);

    // UI State (Modals)
    const showModal = ref(false);
    const showCleanupModal = ref(false);
    
    // NEW: Fast Confirm Modal State
    const showConfirmModal = ref(false);
    const confirmMessage = ref('');
    const reviewToConfirm = ref<SubmissionReview | null>(null);
    const showSuccessModal = ref(false);
    const successMessage = ref('');
    const selectedReview = ref<SubmissionReview | null>(null);
    const modalStartInReject = ref(false);

    // Filter State
    const activeStatusTab = ref('PENDING'); 
    const searchFilters = ref({
        search: '',
        wasteType: '',
        startDate: '',
        endDate: '',
        machineId: '',
        location: ''
    });

    // Pagination State
    const currentPage = ref(1);
    const itemsPerPage = ref(10);

    // --- Computed Logic ---
    const filteredReviews = computed(() => {
        return reviews.value.filter(item => {
            if (item.status !== activeStatusTab.value) return false;
            const q = searchFilters.value.search.toLowerCase();
            if (q) {
                const match = (item.users?.phone || '').includes(q) ||
                    (item.device_no || '').toLowerCase().includes(q) ||
                    (item.vendor_record_id || '').toLowerCase().includes(q);
                if (!match) return false;
            }
            if (searchFilters.value.wasteType && !item.waste_type?.includes(searchFilters.value.wasteType)) return false;
            if (searchFilters.value.machineId && item.device_no !== searchFilters.value.machineId) return false;
            if (searchFilters.value.startDate || searchFilters.value.endDate) {
                if (!item.submitted_at) return false;
                const itemDate = item.submitted_at.split('T')[0] || '';
                if (searchFilters.value.startDate && itemDate < searchFilters.value.startDate) return false;
                if (searchFilters.value.endDate && itemDate > searchFilters.value.endDate) return false;
            }
            return true;
        });
    });

    const totalPages = computed(() => Math.ceil(filteredReviews.value.length / itemsPerPage.value));
    
    const paginatedReviews = computed(() => {
        const start = (currentPage.value - 1) * itemsPerPage.value;
        const end = start + itemsPerPage.value;
        return filteredReviews.value.slice(start, end);
    });

    watch(filteredReviews, () => { currentPage.value = 1; });

    // --- Actions ---

    const fetchReviews = async () => {
        const auth = useAuthStore();
        
        // Wait for auth to be loaded if still loading or role not set
        if (auth.loading || !auth.role) {
            console.log("SubmissionReviews: Waiting for auth/role to be ready... loading:", auth.loading, "role:", auth.role);
            // Don't return - try again after a short delay
            setTimeout(() => fetchReviews(), 500);
            return;
        }
        
        loading.value = true;
        console.log("SubmissionReviews: Fetching with role:", auth.role);
        try {
            let query = supabase
                .from('submission_reviews')
                .select(`*, users(nickname, avatar_url, phone)`)
                .order('submitted_at', { ascending: false });

            // VIEWER role can see ALL data, others get filtered by merchant
            // Check VIEWER first before checking merchantId
            if (auth.role === 'VIEWER') {
                // No filter - see all data
            } else if (auth.merchantId) {
                query = query.eq('merchant_id', auth.merchantId);
            }

            const { data, error } = await query;
            console.log("SubmissionReviews: Raw response - data:", data?.length, "records, error:", error);
            if (error) throw error;
            if (data) {
                console.log("SubmissionReviews: Setting reviews to", data.length, "records");
                reviews.value = data as SubmissionReview[];
            }
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            loading.value = false;
        }
    };

    const harvestNewSubmissions = async (force = false) => {
        isHarvesting.value = true;
        try {
            // Pass the force flag to the service
            await runHarvester(force);
            await fetchReviews();
        } catch (err) {
            console.error("Harvest failed:", err);
        } finally {
            isHarvesting.value = false;
        }
    };

    // Open Main Correction Modal
    const openReviewModal = (review: SubmissionReview, startReject: boolean = false) => {
        selectedReview.value = review;
        modalStartInReject.value = startReject;
        showModal.value = true;
    };

    // 🔥 NEW: Trigger Fast Confirm Modal (Replaces window.confirm)
    const triggerFastConfirm = (review: SubmissionReview) => {
        reviewToConfirm.value = review;
        const points = (review.api_weight * review.rate_per_kg).toFixed(2);
        confirmMessage.value = `Approve Submission #${review.vendor_record_id.slice(-6)}?\nWeight: ${review.api_weight}kg\nPoints: ${points}`;
        showConfirmModal.value = true;
    };

    // NEW: Actual Execution of Fast Confirm
    const executeFastConfirm = async () => {
        if (!reviewToConfirm.value) return;
        isProcessing.value = true;
        
        const success = await verifySubmission(
            reviewToConfirm.value.id, 
            reviewToConfirm.value.api_weight, 
            reviewToConfirm.value.rate_per_kg
        );
        
        isProcessing.value = false;

        if (success) {
            showConfirmModal.value = false;
            reviewToConfirm.value = null;
            successMessage.value = "Submission verified successfully!";
            showSuccessModal.value = true;
        } else {
            showConfirmModal.value = false; 
        }
    };

    const handleCorrectionSubmit = async (finalWeight: number) => {
        if (!selectedReview.value) return;
        isProcessing.value = true;
        
        const success = await verifySubmission(
            selectedReview.value.id, 
            finalWeight, 
            selectedReview.value.rate_per_kg
        );
        
        isProcessing.value = false;

        if (success) {
            showModal.value = false;
            successMessage.value = "Submission updated and verified successfully!";
            showSuccessModal.value = true;
        }
    };

    const handleRejectSubmit = async (reason: string) => {
        if (!selectedReview.value) return;
        isProcessing.value = true;
        
        const success = await rejectSubmission(selectedReview.value.id, reason);

        isProcessing.value = false;

        if (success) {
            showModal.value = false;
            successMessage.value = "Submission rejected.";
            showSuccessModal.value = true;
        }
    };

    const handleCleanupSubmit = async (months: number) => {
        isProcessing.value = true;
        const count = await cleanupOldData(months);
        isProcessing.value = false;
        showCleanupModal.value = false;
        if (count >= 0) {
            alert(`Cleanup Complete. Deleted ${count} old records.`);
            fetchReviews();
        } else {
            alert("Error cleaning up data.");
        }
    };

    // --- Private/Internal Actions (FIXED COLUMN NAMES HERE) ---

    const verifySubmission = async (reviewId: string, finalWeight: number, currentRate: number) => {
        try {
            // This line was already good, keep it!
            const finalPoints = parseFloat((finalWeight * currentRate).toFixed(2));

            const { data: review, error: fetchError } = await supabase
                .from('submission_reviews')
                .select('user_id, merchant_id')
                .eq('id', reviewId)
                .single();

            if (fetchError || !review) throw new Error("Review not found");

            // 2. UPDATE REVIEW STATUS
            const { error: updateError } = await supabase
                .from('submission_reviews')
                .update({
                    status: 'VERIFIED',
                    confirmed_weight: finalWeight,
                    calculated_value: finalPoints, // ✅ FIXED: DB Column is 'calculated_value'
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', reviewId);

            if (updateError) throw updateError;

            // 3. CREDIT MERCHANT WALLET (The Money Part)
            const { data: wallet } = await supabase
                .from('merchant_wallets')
                .select('id, current_balance, total_earnings, total_weight')
                .eq('user_id', review.user_id)
                .eq('merchant_id', review.merchant_id)
                .maybeSingle();

            let newBalance = finalPoints;

            if (wallet) {
                // 🟢 FIX 2: Rounding during addition
                // JavaScript: 10.1 + 1.1 = 11.2000000000001
                newBalance = Number((Number(wallet.current_balance) + finalPoints).toFixed(2));
                
                const newTotalEarnings = Number((Number(wallet.total_earnings) + finalPoints).toFixed(2));
                const newTotalWeight = Number((Number(wallet.total_weight || 0) + finalWeight).toFixed(3)); // Weight to 3 decimals

                await supabase.from('merchant_wallets').update({
                    current_balance: newBalance,
                    total_earnings: newTotalEarnings,
                    total_weight: newTotalWeight
                }).eq('id', wallet.id);
            } else {
                // Create new wallet
                await supabase.from('merchant_wallets').insert({
                    user_id: review.user_id,
                    merchant_id: review.merchant_id,
                    current_balance: finalPoints,
                    total_earnings: finalPoints,
                    total_weight: finalWeight
                });
            }

            // 4. LOG TRANSACTION (The Audit Trail)
            await supabase.from('wallet_transactions').insert({
                user_id: review.user_id,
                merchant_id: review.merchant_id,
                amount: finalPoints,
                balance_after: newBalance,
                transaction_type: 'RECYCLE_EARNING',
                description: `Recycled ${finalWeight}kg (Verified)`
            });

            // 5. UPDATE USER STATS
            const { data: user } = await supabase
                .from('users')
                .select('lifetime_integral, total_weight')
                .eq('id', review.user_id)
                .single();

            if (user) {
                // 🟢 FIX 3: Round User Totals too
                const newLifetime = Number(((Number(user.lifetime_integral) || 0) + finalPoints).toFixed(2));
                const newTotalWeight = Number(((Number(user.total_weight) || 0) + finalWeight).toFixed(3));

                await supabase.from('users').update({
                    lifetime_integral: newLifetime,
                    total_weight: newTotalWeight
                }).eq('id', review.user_id);
            }

            await fetchReviews();
            return true;
        } catch (err) {
            console.error("Verification failed:", err);
            return false;
        }
    };

    const rejectSubmission = async (reviewId: string, reason: string) => {
        try {
            const { error } = await supabase
                .from('submission_reviews')
                .update({
                    status: 'REJECTED',
                    confirmed_weight: 0,
                    calculated_value: 0, // ✅ FIXED: Was calculated_points
                    reviewer_note: reason,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', reviewId);

            if (error) throw error;
            await fetchReviews();
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const cleanupOldData = async (months: number) => {
        try {
            const { data, error } = await supabase.rpc('delete_old_submissions', { months_to_keep: months });
            if (error) throw error;
            return data;
        } catch (err) {
            console.error(err);
            return -1;
        }
    }

    return {
        reviews, loading, isHarvesting, isProcessing,
        showModal, showCleanupModal, selectedReview, modalStartInReject,

        showSuccessModal, successMessage,
        
        // Confirm Modal Exports
        showConfirmModal, confirmMessage, triggerFastConfirm, executeFastConfirm,

        activeStatusTab, searchFilters, currentPage, itemsPerPage,
        paginatedReviews, totalPages, filteredReviews,
        
        fetchReviews, harvestNewSubmissions, openReviewModal,
        handleCorrectionSubmit, handleRejectSubmit, handleCleanupSubmit
    };
}