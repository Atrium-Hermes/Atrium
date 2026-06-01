// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title AtriumRegistry
 * @notice Skill provenance + royalty marketplace.
 *
 * Lifecycle:
 *   1. Creator calls registerSkill() with IPFS CID + price + optional parents
 *   2. Consumer calls invokeSkill() with USDC approve+payment
 *   3. Contract auto-splits payment: protocol fee → parent royalties → creator
 *   4. Anyone can attestBenchmark() with capability proof
 *   5. Creators/parents call withdraw() to claim accumulated USDC
 *
 * Royalty cap: parents combined can take at most 50% (5000 bps)
 * Protocol fee: 2.5% (250 bps), adjustable by owner up to 5%
 */
contract AtriumRegistry {
    // ─────────── Errors ───────────
    error LengthMismatch();
    error RoyaltyTooHigh();
    error ParentInactive();
    error SkillExists();
    error SkillInactive();
    error NotCreator();
    error TransferFailed();
    error NothingToWithdraw();
    error InvalidSuccessRate();
    error FeeTooHigh();
    error NotOwner();
    error ZeroPrice();
    error ZeroAddress();
    error TooManyParents();
    error PriceTooHigh();

    // ─────────── Types ───────────
    struct Skill {
        string cid; // IPFS CID of skill manifest
        address creator; // Withdraw destination
        bytes32 didHash; // keccak256("did:gitlawb:...")
        uint256 pricePerCall; // USDC (6 decimals) per invocation
        bytes32[] parentSkills; // Royalty cascade ancestors
        uint16[] parentBps; // Basis points to each parent (sum ≤ 5000)
        uint64 createdAt;
        uint64 lastInvoked;
        uint128 totalInvocations;
        uint128 totalEarned; // Cumulative USDC routed to this skill
        bool active;
    }

    struct Attestation {
        bytes32 benchmarkHash; // Merkle root of input/output pairs
        uint16 successRate; // 0–10000 bps
        uint64 attestedAt;
        address attester;
        uint128 sampleCount; // How many test cases run
    }

    // ─────────── State ───────────
    IERC20 public immutable usdc;
    address public owner;
    address public protocolTreasury;
    uint16 public protocolFeeBps = 250; // 2.5%
    uint16 public constant MAX_PROTOCOL_FEE = 500; // 5% ceiling
    uint16 public constant MAX_PARENT_ROYALTY = 5000; // 50% combined
    uint256 public constant MAX_PARENTS = 5; // bound the invoke-time royalty loop

    mapping(bytes32 => Skill) public skills;
    mapping(bytes32 => Attestation) public attestations;
    mapping(address => uint256) public withdrawable;

    // Discovery indexes (off-chain indexer mirrors these)
    bytes32[] public allSkills;
    mapping(address => bytes32[]) public skillsByCreator;

    // ─────────── Events ───────────
    event SkillRegistered(
        bytes32 indexed skillId,
        address indexed creator,
        bytes32 indexed didHash,
        string cid,
        uint256 pricePerCall,
        bytes32[] parentSkills,
        uint16[] parentBps
    );
    event SkillInvoked(
        bytes32 indexed skillId, address indexed caller, uint256 amount, uint128 invocationNumber
    );
    event RoyaltyPaid(
        bytes32 indexed parentSkillId,
        bytes32 indexed childSkillId,
        address indexed parentCreator,
        uint256 amount
    );
    event Withdraw(address indexed user, uint256 amount);
    event BenchmarkAttested(
        bytes32 indexed skillId,
        address indexed attester,
        bytes32 benchmarkHash,
        uint16 successRate,
        uint128 sampleCount
    );
    event SkillDeactivated(bytes32 indexed skillId);
    event SkillReactivated(bytes32 indexed skillId);
    event ProtocolFeeUpdated(uint16 oldFee, uint16 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ─────────── Modifiers ───────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─────────── Constructor ───────────
    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
        protocolTreasury = _treasury;
    }

    // ─────────── Skill registry ───────────

    /**
     * @notice Register a new skill. SkillId is deterministic:
     *         keccak256(cid, didHash, creator) — same content from same creator = same id.
     */
    function registerSkill(
        string calldata cid,
        bytes32 didHash,
        uint256 pricePerCall,
        bytes32[] calldata parentSkills,
        uint16[] calldata parentBps
    ) external returns (bytes32 skillId) {
        if (pricePerCall == 0) revert ZeroPrice();
        if (parentSkills.length != parentBps.length) revert LengthMismatch();
        if (parentSkills.length > MAX_PARENTS) revert TooManyParents();

        uint256 totalBps;
        for (uint256 i; i < parentBps.length; ++i) {
            if (!skills[parentSkills[i]].active) revert ParentInactive();
            totalBps += parentBps[i];
        }
        if (totalBps > MAX_PARENT_ROYALTY) revert RoyaltyTooHigh();

        skillId = keccak256(abi.encodePacked(cid, didHash, msg.sender));
        // Dedup on existence, not active status. A deactivated skillId must never
        // be re-registered: doing so would silently mutate its price/parents/
        // royalty terms and preserve stale cumulative stats, breaking the
        // provenance-immutability guarantee. Use reactivateSkill() to re-list.
        if (skills[skillId].creator != address(0)) revert SkillExists();

        Skill storage s = skills[skillId];
        s.cid = cid;
        s.creator = msg.sender;
        s.didHash = didHash;
        s.pricePerCall = pricePerCall;
        s.parentSkills = parentSkills;
        s.parentBps = parentBps;
        s.createdAt = uint64(block.timestamp);
        s.active = true;

        allSkills.push(skillId);
        skillsByCreator[msg.sender].push(skillId);

        emit SkillRegistered(skillId, msg.sender, didHash, cid, pricePerCall, parentSkills, parentBps);
    }

    /**
     * @notice Pay to invoke a skill. Caller must approve USDC beforehand.
     *         Payment splits: protocolFee → parents (cascade) → creator.
     */
    function invokeSkill(bytes32 skillId) external {
        _invoke(skillId, type(uint256).max);
    }

    /**
     * @notice Same as invokeSkill, but reverts if pricePerCall exceeds maxPrice.
     *         The creator can raise the price between an off-chain quote and
     *         on-chain execution; maxPrice bounds what the consumer will pay.
     */
    function invokeSkill(bytes32 skillId, uint256 maxPrice) external {
        _invoke(skillId, maxPrice);
    }

    // Conservation invariant: protocolCut + Σ parentCut + toCreator == price.
    // Cuts floor; the creator absorbs the rounding remainder (toCreator is the
    // residual after subtracting each parentCut), so no wei is ever stranded or
    // created. MAX_PARENT_ROYALTY (≤50%) guarantees toCreator stays positive.
    function _invoke(bytes32 skillId, uint256 maxPrice) internal {
        Skill storage skill = skills[skillId];
        if (!skill.active) revert SkillInactive();

        uint256 price = skill.pricePerCall;
        if (price > maxPrice) revert PriceTooHigh();
        _safeTransferFrom(msg.sender, address(this), price);

        // Protocol cut first
        uint256 protocolCut = (price * protocolFeeBps) / 10000;
        uint256 distributable = price - protocolCut;
        if (protocolCut > 0) withdrawable[protocolTreasury] += protocolCut;

        // Parent royalty cascade
        uint256 toCreator = distributable;
        for (uint256 i; i < skill.parentSkills.length; ++i) {
            uint256 parentCut = (distributable * skill.parentBps[i]) / 10000;
            if (parentCut > 0) {
                Skill storage parent = skills[skill.parentSkills[i]];
                withdrawable[parent.creator] += parentCut;
                parent.totalEarned += uint128(parentCut);
                emit RoyaltyPaid(skill.parentSkills[i], skillId, parent.creator, parentCut);
                toCreator -= parentCut;
            }
        }

        withdrawable[skill.creator] += toCreator;
        skill.totalEarned += uint128(toCreator);
        skill.totalInvocations += 1;
        skill.lastInvoked = uint64(block.timestamp);

        emit SkillInvoked(skillId, msg.sender, price, skill.totalInvocations);
    }

    /**
     * @notice Claim accumulated USDC for any address.
     */
    function withdraw() external {
        uint256 amount = withdrawable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        withdrawable[msg.sender] = 0; // effects before interaction (CEI)
        _safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    /**
     * @notice Attest that a skill passes a benchmark suite.
     *         MVP: anyone can attest. Production: gated by staked attestors.
     */
    function attestBenchmark(bytes32 skillId, bytes32 benchmarkHash, uint16 successRate, uint128 sampleCount)
        external
    {
        if (!skills[skillId].active) revert SkillInactive();
        if (successRate > 10000) revert InvalidSuccessRate();

        attestations[skillId] = Attestation({
            benchmarkHash: benchmarkHash,
            successRate: successRate,
            attestedAt: uint64(block.timestamp),
            attester: msg.sender,
            sampleCount: sampleCount
        });
        emit BenchmarkAttested(skillId, msg.sender, benchmarkHash, successRate, sampleCount);
    }

    /**
     * @notice Creator can deactivate (delisting). Existing royalties to parents
     *         keep accruing until they deactivate too.
     */
    function deactivateSkill(bytes32 skillId) external {
        if (skills[skillId].creator != msg.sender) revert NotCreator();
        skills[skillId].active = false;
        emit SkillDeactivated(skillId);
    }

    /**
     * @notice Re-list a previously deactivated skill. Only the original creator.
     *         Preserves the skill's terms, royalties, and accumulated stats — the
     *         safe alternative to re-registering a delisted id (see registerSkill).
     */
    function reactivateSkill(bytes32 skillId) external {
        if (skills[skillId].creator != msg.sender) revert NotCreator();
        skills[skillId].active = true;
        emit SkillReactivated(skillId);
    }

    // ─────────── Admin ───────────

    function setProtocolFee(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_PROTOCOL_FEE) revert FeeTooHigh();
        emit ProtocolFeeUpdated(protocolFeeBps, newFeeBps);
        protocolFeeBps = newFeeBps;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress(); // else fees accrue to address(0), unrecoverable
        emit TreasuryUpdated(protocolTreasury, newTreasury);
        protocolTreasury = newTreasury;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress(); // zero owner would brick admin permanently
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─────────── Internal: non-standard-ERC20-safe transfers ───────────
    // Canonical USDC returns a bool, but some ERC20s return no data. Accept both:
    // treat a failed call OR an explicit `false` return as a transfer failure.
    // Money path — keep CEI discipline at every call site.
    function _safeTransfer(address to, uint256 amount) internal {
        _erc20Call(abi.encodeWithSelector(usdc.transfer.selector, to, amount));
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        _erc20Call(abi.encodeWithSelector(usdc.transferFrom.selector, from, to, amount));
    }

    function _erc20Call(bytes memory data) private {
        (bool ok, bytes memory ret) = address(usdc).call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    // ─────────── Views ───────────

    function getSkill(bytes32 skillId) external view returns (Skill memory) {
        return skills[skillId];
    }

    function getAttestation(bytes32 skillId) external view returns (Attestation memory) {
        return attestations[skillId];
    }

    function totalSkillCount() external view returns (uint256) {
        return allSkills.length;
    }

    function getSkillsByCreator(address creator) external view returns (bytes32[] memory) {
        return skillsByCreator[creator];
    }

    /**
     * @notice Paginated skill discovery. Use offset+limit to walk the registry.
     */
    function listSkills(uint256 offset, uint256 limit) external view returns (bytes32[] memory page) {
        uint256 total = allSkills.length;
        if (offset >= total) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new bytes32[](end - offset);
        for (uint256 i; i < page.length; ++i) {
            page[i] = allSkills[offset + i];
        }
    }

    /**
     * @notice Predict skillId before registering (for off-chain validation).
     */
    function computeSkillId(string calldata cid, bytes32 didHash, address creator)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(cid, didHash, creator));
    }
}
