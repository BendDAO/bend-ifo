// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IVeBend} from "../interfaces/IVeBend.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VeBend is IVeBend {
    mapping(address => IVeBend.LockedBalance) public locked;

    address BEND_TOKEN_ADDRESS;

    constructor(address bendTokenAddress) {
        BEND_TOKEN_ADDRESS = bendTokenAddress;
    }

    function createLockFor(
        address _beneficiary,
        uint256 _value,
        uint256 _unlockTime
    ) external override {
        IERC20(BEND_TOKEN_ADDRESS).transferFrom(
            msg.sender,
            address(this),
            _value
        );
        locked[_beneficiary] = IVeBend.LockedBalance(
            int256(_value),
            _unlockTime
        );
    }

    function increaseAmountFor(address _beneficiary, uint256 _value)
        external
        override
    {
        IERC20(BEND_TOKEN_ADDRESS).transferFrom(
            msg.sender,
            address(this),
            _value
        );
        locked[_beneficiary].amount =
            locked[_beneficiary].amount +
            int256(_value);
    }

    function getLocked(address _addr)
        external
        view
        override
        returns (LockedBalance memory)
    {
        return locked[_addr];
    }

    function balanceOf(address _addr) external view override returns (uint256) {
        return uint256(locked[_addr].amount);
    }
}
