// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChipInPool
 * @dev Individual pool contract for group crypto purchases
 */
contract ChipInPool is ReentrancyGuard {
    IERC20 public immutable usdc;
    address public immutable creator;
    address public immutable factory;
    
    string public title;
    string public description;
    uint256 public targetAmount;
    address public targetToken;
    uint256 public deadline;
    uint256 public maxContributors;
    
    uint256 public totalContributed;
    uint256 public contributorCount;
    bool public goalReached;
    bool public executed;
    bool public cancelled;
    
    struct Contributor {
        uint256 amount;
        bool exists;
    }
    
    mapping(address => Contributor) public contributors;
    address[] public contributorList;
    
    event ContributionMade(address indexed contributor, uint256 amount);
    event GoalReached(uint256 totalAmount);
    event PoolExecuted(address indexed targetToken, uint256 amountSwapped);
    event RefundIssued(address indexed contributor, uint256 amount);
    event PoolCancelled();
    
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator can call this");
        _;
    }
    
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory can call this");
        _;
    }
    
    modifier notExpired() {
        require(block.timestamp <= deadline, "Pool has expired");
        _;
    }
    
    modifier notExecuted() {
        require(!executed && !cancelled, "Pool already executed or cancelled");
        _;
    }
    
    constructor(
        address _usdc,
        address _creator,
        string memory _title,
        string memory _description,
        uint256 _targetAmount,
        address _targetToken,
        uint256 _deadline,
        uint256 _maxContributors
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_creator != address(0), "Invalid creator address");
        require(_targetAmount > 0, "Target amount must be > 0");
        require(_deadline > block.timestamp, "Deadline must be in future");
        require(_maxContributors > 1, "Max contributors must be > 1");
        
        usdc = IERC20(_usdc);
        factory = msg.sender;
        creator = _creator;
        title = _title;
        description = _description;
        targetAmount = _targetAmount;
        targetToken = _targetToken;
        deadline = _deadline;
        maxContributors = _maxContributors;
    }
    
    /**
     * @dev Contribute USDC to the pool
     * @param amount Amount of USDC to contribute (6 decimals)
     */
    function contribute(uint256 amount) external nonReentrant notExpired notExecuted {
        require(amount > 0, "Amount must be > 0");
        require(contributorCount < maxContributors, "Max contributors reached");
        require(totalContributed + amount <= targetAmount, "Would exceed target");
        
        // Transfer USDC from contributor
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        // Track contribution
        if (!contributors[msg.sender].exists) {
            contributors[msg.sender] = Contributor({amount: amount, exists: true});
            contributorList.push(msg.sender);
            contributorCount++;
        } else {
            contributors[msg.sender].amount += amount;
        }
        
        totalContributed += amount;
        
        emit ContributionMade(msg.sender, amount);
        
        // Check if goal reached
        if (totalContributed >= targetAmount) {
            goalReached = true;
            emit GoalReached(totalContributed);
        }
    }
    
    /**
     * @dev Execute the pool by swapping USDC for target token
     * Can only be called by factory (which handles 1inch integration)
     */
    function executeSwap(bytes calldata /**swapdata */) external onlyFactory nonReentrant notExecuted {
        require(goalReached, "Goal not reached yet");
        require(totalContributed > 0, "No funds to swap");
        
        executed = true;
        
        // Approve factory to spend USDC for swap
        usdc.approve(factory, totalContributed);
        
        emit PoolExecuted(targetToken, totalContributed);
        
        // Factory will handle the actual 1inch swap and token distribution
    }
    
    /**
     * @dev Refund contributors if goal not reached by deadline
     */
    function refund() external nonReentrant {
        require(block.timestamp > deadline, "Pool not expired yet");
        require(!goalReached, "Goal was reached");
        require(!cancelled, "Pool already cancelled");
        
        Contributor storage contributor = contributors[msg.sender];
        require(contributor.exists && contributor.amount > 0, "No contribution to refund");
        
        uint256 refundAmount = contributor.amount;
        contributor.amount = 0;
        
        require(usdc.transfer(msg.sender, refundAmount), "Refund transfer failed");
        
        emit RefundIssued(msg.sender, refundAmount);
    }
    
    /**
     * @dev Cancel pool (emergency function for creator)
     */
    function cancel() external onlyCreator notExecuted {
        cancelled = true;
        emit PoolCancelled();
    }
    
    /**
     * @dev Emergency refund for cancelled pools
     */
    function emergencyRefund() external nonReentrant {
        require(cancelled, "Pool not cancelled");
        
        Contributor storage contributor = contributors[msg.sender];
        require(contributor.exists && contributor.amount > 0, "No contribution to refund");
        
        uint256 refundAmount = contributor.amount;
        contributor.amount = 0;
        
        require(usdc.transfer(msg.sender, refundAmount), "Emergency refund failed");
        
        emit RefundIssued(msg.sender, refundAmount);
    }
    
    /**
     * @dev Get pool status and stats
     */
    function getPoolInfo() external view returns (
        string memory _title,
        string memory _description,
        uint256 _targetAmount,
        uint256 _totalContributed,
        uint256 _contributorCount,
        uint256 _deadline,
        bool _goalReached,
        bool _executed,
        bool _cancelled
    ) {
        return (
            title,
            description,
            targetAmount,
            totalContributed,
            contributorCount,
            deadline,
            goalReached,
            executed,
            cancelled
        );
    }
    
    /**
     * @dev Get all contributors
     */
    function getContributors() external view returns (address[] memory, uint256[] memory) {
        uint256[] memory amounts = new uint256[](contributorList.length);
        
        for (uint256 i = 0; i < contributorList.length; i++) {
            amounts[i] = contributors[contributorList[i]].amount;
        }
        
        return (contributorList, amounts);
    }
}

/**
 * @title ChipInFactory
 * @dev Factory contract to create and manage pools
 */
contract ChipInFactory is Ownable, ReentrancyGuard {
    IERC20 public immutable usdc;
    address public oneInchRouter;
    uint256 public poolCount;
    uint256 public factoryFee = 50; // 0.5% fee (basis points)
    
    mapping(uint256 => address) public pools;
    mapping(address => uint256[]) public userPools;
    
    event PoolCreated(
        uint256 indexed poolId,
        address indexed poolAddress,
        address indexed creator,
        string title,
        uint256 targetAmount,
        address targetToken
    );
    
    event SwapExecuted(
        uint256 indexed poolId,
        address indexed targetToken,
        uint256 usdcAmount,
        uint256 tokensReceived
    );
    
    // Fixed: Added initial owner parameter to constructor
    constructor(address _usdc, address _oneInchRouter, address _initialOwner) Ownable(_initialOwner) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
        oneInchRouter = _oneInchRouter;
    }
    
    /**
     * @dev Create a new pool
     */
    function createPool(
        string memory _title,
        string memory _description,
        uint256 _targetAmount,
        address _targetToken,
        uint256 _deadline,
        uint256 _maxContributors
    ) external returns (address poolAddress) {
        require(_targetAmount > 0, "Invalid target amount");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_maxContributors > 1 && _maxContributors <= 100, "Invalid max contributors");
        
        // Create new pool
        ChipInPool newPool = new ChipInPool(
            address(usdc),
            msg.sender,
            _title,
            _description,
            _targetAmount,
            _targetToken,
            _deadline,
            _maxContributors
        );
        
        poolAddress = address(newPool);
        
        // Store pool
        pools[poolCount] = poolAddress;
        userPools[msg.sender].push(poolCount);
        
        emit PoolCreated(
            poolCount,
            poolAddress,
            msg.sender,
            _title,
            _targetAmount,
            _targetToken
        );
        
        poolCount++;
        
        return poolAddress;
    }
    
    /**
     * @dev Execute swap for a pool using 1inch
     */
    function executePoolSwap(
        uint256 poolId,
        bytes calldata oneInchSwapData
    ) external nonReentrant {
        address poolAddress = pools[poolId];
        require(poolAddress != address(0), "Pool does not exist");
        
        ChipInPool pool = ChipInPool(poolAddress);
        require(pool.goalReached(), "Pool goal not reached");
        require(!pool.executed(), "Pool already executed");
        
        uint256 usdcAmount = pool.totalContributed();
        require(usdcAmount > 0, "No USDC to swap");
        
        // Calculate factory fee
        uint256 fee = (usdcAmount * factoryFee) / 10000;
        uint256 swapAmount = usdcAmount - fee;
        
        // Execute pool swap (this will transfer USDC to factory)
        pool.executeSwap("");
        
        // Transfer USDC from pool to factory
        require(usdc.transferFrom(poolAddress, address(this), usdcAmount), "USDC transfer failed");
        
        // Keep fee
        if (fee > 0) {
            require(usdc.transfer(owner(), fee), "Fee transfer failed");
        }
        
        // Execute 1inch swap
        require(usdc.approve(oneInchRouter, swapAmount), "USDC approval failed");
        
        (bool success,) = oneInchRouter.call(oneInchSwapData);
        require(success, "1inch swap failed");
        
        // TODO: Distribute received tokens proportionally to contributors
        // This would require additional logic to handle different token types
        
        emit SwapExecuted(poolId, pool.targetToken(), swapAmount, 0);
    }
    
    /**
     * @dev Get pools created by user
     */
    function getUserPools(address user) external view returns (uint256[] memory) {
        return userPools[user];
    }
    
    /**
     * @dev Get pool address by ID
     */
    function getPool(uint256 poolId) external view returns (address) {
        return pools[poolId];
    }
    
    /**
     * @dev Update 1inch router address
     */
    function updateOneInchRouter(address newRouter) external onlyOwner {
        oneInchRouter = newRouter;
    }
    
    /**
     * @dev Update factory fee
     */
    function updateFactoryFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee too high"); // Max 5%
        factoryFee = newFee;
    }
}

/**
 * @title ChipInRegistry
 * @dev Registry to track all pools and provide discovery
 */
contract ChipInRegistry {
    struct PoolInfo {
        address poolAddress;
        address creator;
        string title;
        uint256 targetAmount;
        address targetToken;
        uint256 deadline;
        bool active;
    }
    
    mapping(uint256 => PoolInfo) public poolRegistry;
    uint256 public totalPools;
    
    event PoolRegistered(uint256 indexed poolId, address indexed poolAddress, address indexed creator);
    
    function registerPool(
        address poolAddress,
        address creator,
        string memory _title,
        uint256 targetAmount,
        address targetToken,
        uint256 deadline
    ) external returns (uint256 poolId) {
        poolId = totalPools;
        
        poolRegistry[poolId] = PoolInfo({
            poolAddress: poolAddress,
            creator: creator,
            title: _title,
            targetAmount: targetAmount,
            targetToken: targetToken,
            deadline: deadline,
            active: true
        });
        
        totalPools++;
        
        emit PoolRegistered(poolId, poolAddress, creator);
        
        return poolId;
    }
    
    function getActivePools(uint256 offset, uint256 limit) external view returns (PoolInfo[] memory) {
        require(limit <= 50, "Limit too high");
        
        uint256 activeCount = 0;
        
        // Count active pools
        for (uint256 i = 0; i < totalPools; i++) {
            if (poolRegistry[i].active && poolRegistry[i].deadline > block.timestamp) {
                activeCount++;
            }
        }
        
        if (offset >= activeCount) {
            return new PoolInfo[](0);
        }
        
        uint256 returnCount = activeCount - offset;
        if (returnCount > limit) {
            returnCount = limit;
        }
        
        PoolInfo[] memory activePools = new PoolInfo[](returnCount);
        uint256 currentIndex = 0;
        uint256 returnIndex = 0;
        
        for (uint256 i = 0; i < totalPools && returnIndex < returnCount; i++) {
            if (poolRegistry[i].active && poolRegistry[i].deadline > block.timestamp) {
                if (currentIndex >= offset) {
                    activePools[returnIndex] = poolRegistry[i];
                    returnIndex++;
                }
                currentIndex++;
            }
        }
        
        return activePools;
    }
}

/**
 * @title MockERC20
 * @dev Mock ERC20 for testing purposes
 */
contract MockERC20 is IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    
    uint256 private _totalSupply;
    string public name;
    string public symbol;
    uint8 public decimals;
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }
    
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }
    
    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        address spender = msg.sender;
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }
    
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
    
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: mint to the zero address");
        
        _totalSupply += amount;
        unchecked {
            _balances[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }
    
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }
        
        emit Transfer(from, to, amount);
    }
    
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
    
    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }
}