// This is a placeholder for now. The logic to create the transaction form
// and generate the smart link will be built here in the next phase.
function generateTransactionLink(txnId, userReferralCode) {
    const baseUrl = `${window.location.origin}/confirm.html`;
    return `${baseUrl}?txn=${txnId}&ref=${userReferralCode}`;
}