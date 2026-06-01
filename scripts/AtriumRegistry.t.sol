// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/AtriumRegistry.sol";

// Minimal USDC mock for testing
contract MockUSDC {
    string public name = "Mock USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        require(balanceOf[from] >= amount, "insufficient balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract AtriumRegistryTest is Test {
    AtriumRegistry registry;
    MockUSDC usdc;

    address alice = makeAddr("alice"); // creator
    address bob = makeAddr("bob"); // consumer
    address carol = makeAddr("carol"); // parent creator
    address treasury = makeAddr("treasury");

    bytes32 constant ALICE_DID_HASH = keccak256("did:key:alice");
    bytes32 constant CAROL_DID_HASH = keccak256("did:key:carol");

    // Mirror of the registry event (Solc 0.8.20 can't reference it via the contract type).
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    function setUp() public {
        usdc = new MockUSDC();
        registry = new AtriumRegistry(address(usdc), treasury);

        usdc.mint(bob, 1_000 * 1e6); // 1000 USDC

        vm.prank(bob);
        usdc.approve(address(registry), type(uint256).max);
    }

    // ─────────── Register ───────────

    function test_RegisterSkill_basic() public {
        vm.prank(alice);
        bytes32 skillId = registry.registerSkill(
            "bafkreih_test_cid",
            ALICE_DID_HASH,
            5_000, // 0.005 USDC
            new bytes32[](0),
            new uint16[](0)
        );

        (string memory cid, address creator, bytes32 didHash, uint256 price,,,,, bool active) =
            registry.skills(skillId);

        assertEq(cid, "bafkreih_test_cid");
        assertEq(creator, alice);
        assertEq(didHash, ALICE_DID_HASH);
        assertEq(price, 5_000);
        assertTrue(active);
        assertEq(registry.totalSkillCount(), 1);
    }

    function test_RegisterSkill_revertsOnZeroPrice() public {
        vm.prank(alice);
        vm.expectRevert(AtriumRegistry.ZeroPrice.selector);
        registry.registerSkill("cid", ALICE_DID_HASH, 0, new bytes32[](0), new uint16[](0));
    }

    function test_RegisterSkill_revertsOnDuplicate() public {
        vm.startPrank(alice);
        registry.registerSkill("cid1", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));
        vm.expectRevert(AtriumRegistry.SkillExists.selector);
        registry.registerSkill("cid1", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));
        vm.stopPrank();
    }

    function test_RegisterSkill_revertsOnHighRoyalty() public {
        // First register parent
        vm.prank(carol);
        bytes32 parentId =
            registry.registerSkill("parent_cid", CAROL_DID_HASH, 1_000, new bytes32[](0), new uint16[](0));

        bytes32[] memory parents = new bytes32[](1);
        parents[0] = parentId;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 6_000; // 60% > 50% cap

        vm.prank(alice);
        vm.expectRevert(AtriumRegistry.RoyaltyTooHigh.selector);
        registry.registerSkill("derived", ALICE_DID_HASH, 5_000, parents, bps);
    }

    function test_RegisterSkill_revertsOnInactiveParent() public {
        // Register parent
        vm.prank(carol);
        bytes32 parentId =
            registry.registerSkill("parent_cid", CAROL_DID_HASH, 1_000, new bytes32[](0), new uint16[](0));

        // Deactivate it
        vm.prank(carol);
        registry.deactivateSkill(parentId);

        bytes32[] memory parents = new bytes32[](1);
        parents[0] = parentId;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 1_000;

        vm.prank(alice);
        vm.expectRevert(AtriumRegistry.ParentInactive.selector);
        registry.registerSkill("derived", ALICE_DID_HASH, 5_000, parents, bps);
    }

    // ─────────── Invoke + Withdraw ───────────

    function test_InvokeSkill_paysCreator() public {
        vm.prank(alice);
        bytes32 skillId =
            registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));

        vm.prank(bob);
        registry.invokeSkill(skillId);

        // Bob paid 5000 (0.005 USDC)
        assertEq(usdc.balanceOf(bob), 1_000 * 1e6 - 5_000);

        // Protocol fee: 2.5% of 5000 = 125
        assertEq(registry.withdrawable(treasury), 125);

        // Alice gets the rest: 5000 - 125 = 4875
        assertEq(registry.withdrawable(alice), 4_875);

        // Invocation tracked
        (,,,,,, uint128 invocations, uint128 earned,) = registry.skills(skillId);
        assertEq(invocations, 1);
        assertEq(earned, 4_875);
    }

    function test_InvokeSkill_withRoyaltyCascade() public {
        // Carol registers parent skill at 1000
        vm.prank(carol);
        bytes32 parentId =
            registry.registerSkill("parent_cid", CAROL_DID_HASH, 1_000, new bytes32[](0), new uint16[](0));

        // Alice derives a skill from it with 20% royalty
        bytes32[] memory parents = new bytes32[](1);
        parents[0] = parentId;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 2_000; // 20%

        vm.prank(alice);
        bytes32 derivedId = registry.registerSkill("derived_cid", ALICE_DID_HASH, 10_000, parents, bps);

        vm.prank(bob);
        registry.invokeSkill(derivedId);

        // Bob paid 10_000 (0.01 USDC)
        // Protocol: 2.5% = 250
        // Distributable: 9750
        // Carol's royalty: 20% of 9750 = 1950
        // Alice gets: 9750 - 1950 = 7800

        assertEq(registry.withdrawable(treasury), 250);
        assertEq(registry.withdrawable(carol), 1_950);
        assertEq(registry.withdrawable(alice), 7_800);

        (,,,,,,, uint128 parentEarned,) = registry.skills(parentId);
        assertEq(parentEarned, 1_950);
    }

    function test_Withdraw_paysOut() public {
        vm.prank(alice);
        bytes32 skillId =
            registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));

        vm.prank(bob);
        registry.invokeSkill(skillId);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        registry.withdraw();

        assertEq(usdc.balanceOf(alice), aliceBefore + 4_875);
        assertEq(registry.withdrawable(alice), 0);
    }

    function test_Withdraw_revertsOnZero() public {
        vm.prank(alice);
        vm.expectRevert(AtriumRegistry.NothingToWithdraw.selector);
        registry.withdraw();
    }

    function test_InvokeSkill_revertsOnInactive() public {
        vm.prank(alice);
        bytes32 skillId =
            registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));

        vm.prank(alice);
        registry.deactivateSkill(skillId);

        vm.prank(bob);
        vm.expectRevert(AtriumRegistry.SkillInactive.selector);
        registry.invokeSkill(skillId);
    }

    // ─────────── Attestation ───────────

    function test_AttestBenchmark() public {
        vm.prank(alice);
        bytes32 skillId =
            registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));

        bytes32 benchmarkRoot = keccak256("benchmark_v1");
        vm.prank(carol);
        registry.attestBenchmark(skillId, benchmarkRoot, 9_500, 50);

        (bytes32 root, uint16 rate,, address attester, uint128 samples) = registry.attestations(skillId);
        assertEq(root, benchmarkRoot);
        assertEq(rate, 9_500);
        assertEq(attester, carol);
        assertEq(samples, 50);
    }

    function test_AttestBenchmark_revertsOnInvalidRate() public {
        vm.prank(alice);
        bytes32 skillId =
            registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));

        vm.prank(carol);
        vm.expectRevert(AtriumRegistry.InvalidSuccessRate.selector);
        registry.attestBenchmark(skillId, bytes32(0), 11_000, 50);
    }

    // ─────────── Admin ───────────

    function test_SetProtocolFee() public {
        registry.setProtocolFee(400); // 4%
        assertEq(registry.protocolFeeBps(), 400);
    }

    function test_SetProtocolFee_revertsOnTooHigh() public {
        vm.expectRevert(AtriumRegistry.FeeTooHigh.selector);
        registry.setProtocolFee(600); // > 5%
    }

    function test_SetProtocolFee_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(AtriumRegistry.NotOwner.selector);
        registry.setProtocolFee(100);
    }

    // ─────────── Fuzz: 1000 invocations ───────────

    function testFuzz_InvocationsAccumulate(uint8 count) public {
        vm.assume(count > 0 && count <= 100);

        vm.prank(alice);
        bytes32 skillId = registry.registerSkill(
            "cid",
            ALICE_DID_HASH,
            100,
            new bytes32[](0),
            new uint16[](0) // tiny price
        );

        for (uint256 i = 0; i < count; i++) {
            vm.prank(bob);
            registry.invokeSkill(skillId);
        }

        (,,,,,, uint128 invocations,,) = registry.skills(skillId);
        assertEq(invocations, count);
    }

    // ─────────── Pagination ───────────

    function test_ListSkills_paginates() public {
        for (uint256 i = 0; i < 15; i++) {
            vm.prank(alice);
            registry.registerSkill(
                string(abi.encodePacked("cid_", vm.toString(i))),
                ALICE_DID_HASH,
                1_000,
                new bytes32[](0),
                new uint16[](0)
            );
        }

        bytes32[] memory page = registry.listSkills(0, 10);
        assertEq(page.length, 10);

        page = registry.listSkills(10, 10);
        assertEq(page.length, 5);

        page = registry.listSkills(20, 10);
        assertEq(page.length, 0);
    }

    // ─────────── Security fixes ───────────

    // Finding #1: a deactivated id must never be re-registered.
    function test_RegisterSkill_revertsReRegisterAfterDeactivate() public {
        vm.startPrank(alice);
        bytes32 id = registry.registerSkill("cid1", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));
        registry.deactivateSkill(id);
        vm.expectRevert(AtriumRegistry.SkillExists.selector);
        registry.registerSkill("cid1", ALICE_DID_HASH, 9_999, new bytes32[](0), new uint16[](0));
        vm.stopPrank();
    }

    // reactivate re-lists without resetting terms/stats or duplicating the index.
    function test_ReactivateSkill_preservesStatsAndRelists() public {
        vm.prank(alice);
        bytes32 id = registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));

        vm.prank(bob);
        registry.invokeSkill(id);

        vm.prank(alice);
        registry.deactivateSkill(id);
        vm.prank(alice);
        registry.reactivateSkill(id);

        vm.prank(bob);
        registry.invokeSkill(id);

        (,,,,,, uint128 invocations, uint128 earned, bool active) = registry.skills(id);
        assertTrue(active);
        assertEq(invocations, 2);
        assertEq(earned, 9_750); // 2 × 4875, stats preserved across relist
        assertEq(registry.withdrawable(alice), 9_750);
        assertEq(registry.totalSkillCount(), 1); // no duplicate id pushed
    }

    function test_ReactivateSkill_revertsForNonCreator() public {
        vm.prank(alice);
        bytes32 id = registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));
        vm.prank(alice);
        registry.deactivateSkill(id);

        vm.prank(bob);
        vm.expectRevert(AtriumRegistry.NotCreator.selector);
        registry.reactivateSkill(id);
    }

    // Finding #6: parent array is bounded (length check precedes the active check).
    function test_RegisterSkill_revertsOnTooManyParents() public {
        bytes32[] memory parents = new bytes32[](6);
        uint16[] memory bps = new uint16[](6);
        for (uint256 i; i < 6; ++i) {
            bps[i] = 100;
        }
        vm.prank(alice);
        vm.expectRevert(AtriumRegistry.TooManyParents.selector);
        registry.registerSkill("derived", ALICE_DID_HASH, 5_000, parents, bps);
    }

    // Finding #4: treasury cannot be zeroed (would strand protocol fees).
    function test_SetTreasury_revertsOnZero() public {
        vm.expectRevert(AtriumRegistry.ZeroAddress.selector);
        registry.setTreasury(address(0));
    }

    function test_SetTreasury_works() public {
        address t = makeAddr("newTreasury");
        registry.setTreasury(t);
        assertEq(registry.protocolTreasury(), t);
    }

    // Finding #5: ownership transfer is guarded and emits an event.
    function test_TransferOwnership_revertsOnZero() public {
        vm.expectRevert(AtriumRegistry.ZeroAddress.selector);
        registry.transferOwnership(address(0));
    }

    function test_TransferOwnership_works() public {
        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(address(this), alice);
        registry.transferOwnership(alice);
        assertEq(registry.owner(), alice);
    }

    // Finding #8: maxPrice guards the consumer against a price bump.
    function test_InvokeSkill_maxPrice_revertsWhenExceeded() public {
        vm.prank(alice);
        bytes32 id = registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));

        vm.prank(bob);
        vm.expectRevert(AtriumRegistry.PriceTooHigh.selector);
        registry.invokeSkill(id, 4_999);
    }

    function test_InvokeSkill_maxPrice_succeedsWithinBound() public {
        vm.prank(alice);
        bytes32 id = registry.registerSkill("cid", ALICE_DID_HASH, 5_000, new bytes32[](0), new uint16[](0));

        vm.prank(bob);
        registry.invokeSkill(id, 5_000);
        assertEq(usdc.balanceOf(bob), 1_000 * 1e6 - 5_000);
        assertEq(registry.withdrawable(alice), 4_875);
    }
}
