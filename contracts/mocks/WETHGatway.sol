// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IWETHGateway} from "../interfaces/IWETHGateway.sol";

contract WETHGateway is IWETHGateway {
    mapping(address => uint256) public balanceOf;

    function depositETH(address onBehalfOf, uint16 referralCode)
        external
        payable
        override
    {
        balanceOf[onBehalfOf] += msg.value;
        referralCode;
    }
}
